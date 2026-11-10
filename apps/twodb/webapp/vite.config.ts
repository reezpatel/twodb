import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// Vite doesn't load the repo-root .env (it loads webapp/.env), and turbo only
// passes through TWODB_* + DEV_HTTPS — so read the root .env ourselves for
// DEV_HTTPS to make HTTPS work no matter how the dev server is launched.
function rootEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const f = path.resolve(__dirname, "../../../.env");
  if (!existsSync(f)) return undefined;
  const m = readFileSync(f, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  return m?.[1].trim();
}

const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";
// WebAuthn needs a secure context, so HTTPS is required when you browse the
// dev server by LAN hostname/IP (https://divine.local:6500) instead of
// localhost. Opt in with DEV_HTTPS=true in the root .env.
const devHttps = rootEnv("DEV_HTTPS") === "true";

// Trusted cert from tools/dev-certs.sh (mkcert). Browsers hard-fail WSS on
// untrusted certs — no click-through like pages get — so the HMR websocket
// needs a locally-trusted cert. Without .dev-certs/ we fall back to an
// inline self-signed cert (browser warning + broken HMR, but serves).
const certDir = path.resolve(__dirname, "../../../.dev-certs");
const certPath = path.join(certDir, "dev.pem");
const keyPath = path.join(certDir, "dev-key.pem");
const hasMkcert = existsSync(certPath) && existsSync(keyPath);

if (devHttps && !hasMkcert) {
  console.warn(
    "[twodb-webapp] DEV_HTTPS=true but .dev-certs/dev.pem not found — serving an untrusted self-signed cert. " +
      "Run tools/dev-certs.sh once for a trusted cert (HMR websocket needs it).",
  );
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 6500,
    strictPort: true,
    host: true, // listen on all interfaces so the LAN hostname/IP works
    // (HMR host needs no override: by default the client connects back to the
    // host the browser used — e.g. wss://divine.local:6500. When it fails,
    // the cause is cert trust: browsers hard-fail WSS on untrusted certs.
    // Run tools/dev-certs.sh so .dev-certs/dev.pem is served.)
    ...(devHttps
      ? hasMkcert
        ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } }
        : { https: {} } // vite generates a throwaway cert when https:{} and no plugin
      : {}),
    proxy: {
      "/api": { target: gateway, changeOrigin: true },
      "/registry": { target: gateway, changeOrigin: true },
      "/orchestrator": { target: gateway, changeOrigin: true },
      // The gateway's app proxy (/apps/<slug>/<path>) doubles as the SPA's
      // /apps page route — the page is EXACTLY "/apps" (react-router), API
      // calls are always deeper (/apps/<slug>/...). Proxy only the latter;
      // the bare /apps path falls through to Vite's SPA fallback.
      "/apps": {
        target: gateway,
        changeOrigin: true,
        bypass: (req) => (req.url === "/apps" || req.url === "/apps/" ? "/index.html" : undefined),
      },
    },
  },
});
