import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Plugin view bundles are served by the api under /api/v1/plugins/<id>/view/
// and loaded by the shell as native ESM. They keep the react family external
// so they run on the SHELL'S react — the same instance the importing
// ("parent") code uses. The browser has no "inherit the importer's deps"
// mechanism: bare specifiers resolve through the document's import map, and
// module identity is by URL. Pointing the map straight at Vite's optimized
// dep files fails two ways: their URLs carry a `?v=<optimizerHash>` that
// rotates (a stale map would silently load a SECOND react), and optimized
// CJS deps are default-export-only (`export default require_react()`), so
// the bundle's named `import { jsx, Fragment }` is a SyntaxError. Both are
// solved by serving tiny facade modules at STABLE urls
// (/@twodb-view-deps/react.js, …) that re-export the live-hash optimized
// module's named exports — same module instance as the shell's own code,
// real named exports, hash-free import map.
// (Prod builds leave the marker in place; serving plugin views in prod
// needs the shell to externalize react to stable URLs — not wired yet.)
const IMPORTMAP_MARKER = "<!-- twodb:plugin-view-importmap (dev: replaced with a generated import map) -->";
const VIEW_DEP_SPECS = ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query"];
const depsMetadataPath = path.join(import.meta.dirname, "node_modules/.vite/deps/_metadata.json");

const facadePath = (spec: string) => `/@twodb-view-deps/${spec.replace(/\//g, "_")}.js`;

function pluginViewImportmap(): Plugin {
  return {
    name: "twodb-plugin-view-importmap",
    apply: "serve",
    transformIndexHtml(html) {
      const imports = Object.fromEntries(VIEW_DEP_SPECS.map((spec) => [spec, facadePath(spec)]));
      return html.replace(IMPORTMAP_MARKER, `<script type="importmap">${JSON.stringify({ imports })}</script>`);
    },
  };
}

// Serves the facades. The optimizer hash is read per request so the facade
// always re-exports the CURRENT optimized module — never a second copy.
function pluginViewDepFacades(): Plugin {
  const nodeRequire = createRequire(import.meta.url);
  const exportNames = new Map<string, string[]>();
  return {
    name: "twodb-plugin-view-dep-facades",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /^\/@twodb-view-deps\/([\w@.-]+)\.js$/.exec(req.url ?? "");
        if (!match) return next();

        const file = match[1];
        const spec = file.replace(/_/g, "/");
        if (!VIEW_DEP_SPECS.includes(spec)) {
          res.statusCode = 404;
          res.end(`unknown view dep: ${spec}`);
          return;
        }

        let version = "";
        try {
          const metadata = JSON.parse(fs.readFileSync(depsMetadataPath, "utf8")) as { browserHash?: unknown };
          if (typeof metadata.browserHash === "string" && metadata.browserHash) version = `?v=${metadata.browserHash}`;
        } catch {
          // optimizer hasn't written metadata yet — the unversioned URL
          // still serves the same file, this is cache-busting only
        }

        let names = exportNames.get(spec);
        if (!names) {
          try {
            names = Object.keys(nodeRequire(spec));
            exportNames.set(spec, names);
          } catch {
            names = [];
          }
        }

        // `export default D` keeps default imports (import React from
        // "react") working; `export const { a, b } = D` binds the same
        // objects the optimized module's default export holds — functions
        // included, so hooks land on the shell's single
        // ReactSharedInternals.
        const depUrl = `/node_modules/.vite/deps/${file}.js${version}`;
        let hasDefault = true;
        try {
          const depSource = fs.readFileSync(path.join(import.meta.dirname, `node_modules/.vite/deps/${file}.js`), "utf8");
          hasDefault = /(^|\n)\s*export default|\bas default\b/.test(depSource);
        } catch {
          // file not readable — assume CJS-style default interop
        }
        const source = !hasDefault
          ? `export * from "${depUrl}";\n`
          : names.length
            ? `import D from "${depUrl}";\nexport default D;\nexport const { ${names.join(", ")} } = D;\n`
            : `import D from "${depUrl}";\nexport default D;\n`;
        res.setHeader("content-type", "text/javascript");
        res.end(source);
      });
    },
  };
}

// HTTPS dev mode (TWODB_WEB_HTTPS=1): serves the dev server over TLS so the
// origin is a secure context and WebAuthn (admin passkeys) works when
// browsing via LAN hostname/IP instead of localhost. Generates a self-signed
// cert with SANs for localhost, the machine hostname (+ .local mDNS name),
// and all LAN IPv4 addresses into ../../.work/certs/ (gitignored).
//
// NOTE for WebAuthn: passkeys bind to the exact origin hostname, and rpID
// must be a hostname (IPs are rejected). Browse via the hostname and set
// TWODB_ADMIN_RP_ID / TWODB_ADMIN_ORIGIN in .env to match.

const certsDir = path.resolve(import.meta.dirname, "../../.work/certs");
const certPath = path.join(certsDir, "dev.crt");
const keyPath = path.join(certsDir, "dev.key");

async function ensureDevCert(): Promise<void> {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) return;

  const selfsigned = (await import("selfsigned")).default;

  const dnsNames = ["localhost", os.hostname(), `${os.hostname()}.local`];
  const ipAddrs = ["127.0.0.1"];
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        ipAddrs.push(address.address);
      }
    }
  }

  const pems = await selfsigned.generate([{ name: "commonName", value: "twodb-dev" }], {
    notAfterDate: new Date(Date.now() + 825 * 24 * 3600_000),
    keySize: 2048,
    extensions: [
      {
        name: "subjectAltName",
        altNames: [...dnsNames.map((value) => ({ type: 2 as const, value })), ...ipAddrs.map((ip) => ({ type: 7 as const, ip }))],
      },
    ],
  });

  fs.mkdirSync(certsDir, { recursive: true });
  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(keyPath, pems.private);
  console.log(`[vite] generated self-signed dev cert (SANs: ${[...dnsNames, ...ipAddrs].join(", ")})`);
}

// Load the repo-root .env (same file the api reads) so TWODB_WEB_HTTPS &
// friends work there; process.env still wins when set explicitly.
const rootEnv = loadEnv("development", path.resolve(import.meta.dirname, "../.."), "");
const useHttps = process.env.TWODB_WEB_HTTPS === "1" || rootEnv.TWODB_WEB_HTTPS === "1";
if (useHttps) await ensureDevCert();

export default defineConfig({
  plugins: [
    pluginViewImportmap(),
    pluginViewDepFacades(),
    react({
      babel: {
        // styled-jsx: scoped component styles via `<style jsx>` / css``.
        // Convention lives in /AGENTS.md.
        plugins: ["styled-jsx/babel"],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    // Dev server is reachable over LAN (https via TWODB_WEB_HTTPS=1);
    // vite's default host check would 403 divine/divine.local.
    allowedHosts: true,
    https:
      useHttps && fs.existsSync(certPath) && fs.existsSync(keyPath)
        ? {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
          }
        : undefined,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
