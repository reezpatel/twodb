import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Plugin view bundles are self-contained ESM files under <plugin>/.build/view/.
// The shell loads them as native ESM, but their bare imports (react,
// @tanstack/react-query, @twodb/shared-frontend …) must land on the SHELL'S
// module instances — a second react or react-query copy breaks hooks/contexts
// ("Invalid hook call" / "No QueryClient set"). Import maps + facades turned
// out to chase vite's rotating optimizer hashes and drift into double
// instances. Instead we serve each bundle through vite's OWN transform
// pipeline: server.transformRequest rewrites bare imports to the CURRENT
// optimized/source URLs — module identity is owned by vite and can never
// desync from what the shell itself uses.
const PLUGIN_VIEW_URL_PREFIX = "/@twodb-plugin-view/";

function pluginViewServe(): Plugin {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const byIdentifier = new Map<string, string>();

  const scan = () => {
    const pluginsDir = path.join(repoRoot, "plugins");
    let groups: string[];
    try {
      groups = fs.readdirSync(pluginsDir);
    } catch {
      return;
    }
    for (const group of groups) {
      const candidates = [
        path.join(pluginsDir, group),
        ...fs
          .readdirSync(path.join(pluginsDir, group), { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => path.join(pluginsDir, group, entry.name)),
      ];
      for (const dir of candidates) {
        const pkgPath = path.join(dir, ".build", "package.json");
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { twodb?: { identifier?: string } };
          if (pkg.twodb?.identifier) byIdentifier.set(pkg.twodb.identifier, path.join(dir, ".build"));
        } catch {
          // not a built plugin directory — skip
        }
      }
    }
  };

  return {
    name: "twodb-plugin-view-serve",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = new RegExp(`^${PLUGIN_VIEW_URL_PREFIX}(.+)/main.js$`).exec(decodeURIComponent(req.url ?? ""));
        if (!match) return next();

        if (byIdentifier.size === 0) scan();
        const identifier = match[1];
        const buildDir = byIdentifier.get(identifier);
        const entry = buildDir ? path.join(buildDir, "view", "main.js") : null;
        if (!entry || !fs.existsSync(entry)) {
          res.statusCode = 404;
          res.end(`unknown plugin view: ${identifier}`);
          return;
        }

        try {
          const result = await server.transformRequest(`/@fs/${entry}`);
          if (!result) {
            res.statusCode = 500;
            res.end(`plugin view transform returned nothing for ${identifier}`);
            return;
          }
          res.setHeader("content-type", "text/javascript");
          res.setHeader("cache-control", "no-store");
          res.end(result.code);
        } catch (error) {
          res.statusCode = 500;
          res.end(`plugin view transform failed for ${identifier}: ${error instanceof Error ? error.message : String(error)}`);
        }
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

// Production import map: plugin view bundles keep react/react-query/
// shared-frontend external; in the built app they resolve through this map
// to the vendored single-file ESMs the api serves at /vendor — one module
// instance for shell and plugins alike, exactly like the dev transform
// pipeline guarantees.
function prodImportMap(): Plugin {
  return {
    name: "twodb-prod-import-map",
    apply: "build",
    transformIndexHtml(html) {
      const mapPath = path.resolve(import.meta.dirname, "../api/vendor/import-map.json");
      let map: string;
      try {
        map = fs.readFileSync(mapPath, "utf8").trim();
      } catch {
        console.warn("[vite] apps/api/vendor/import-map.json missing — run node scripts/vendor-deps.mjs before building");
        map = JSON.stringify({ imports: {} });
      }
      return html.replace("</head>", `<script type="importmap">${map}</script></head>`);
    },
  };
}

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
    pluginViewServe(),
    prodImportMap(),
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
