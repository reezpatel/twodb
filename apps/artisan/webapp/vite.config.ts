import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// Dispatch's UI talks to the gateway exactly like it will in prod:
// same-origin, with /apps/artisan/* proxied (auth resolved there, same
// shared control-plane session SSO as the TwoDB webapp). The runner-ws
// upgrade also passes through the gateway's WS passthrough.
const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";

// Same DEV_HTTPS scheme as the other webapps (mkcert certs from .dev-certs/).
function rootEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const f = path.resolve(__dirname, "../../../.env");
  if (!existsSync(f)) return undefined;
  const m = readFileSync(f, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  return m?.[1].trim();
}

const devHttps = rootEnv("DEV_HTTPS") === "true";
const certPath = path.resolve(__dirname, "../../../.dev-certs/dev.pem");
const keyPath = path.resolve(__dirname, "../../../.dev-certs/dev-key.pem");
const hasCerts = existsSync(certPath) && existsSync(keyPath);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 6515,
    strictPort: true,
    host: true,
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: {
      // Dispatch's own API, through the gateway (auth resolved there).
      "/artisan-api": {
        target: gateway,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/artisan-api/, "/apps/artisan"),
        // ws: true not needed here — the terminal relay dials the gateway
        // origin directly (window.location.origin), which the dev server
        // proxies under the /apps key below.
      },
      "/apps": { target: gateway, changeOrigin: true, ws: true },
      "/api": { target: gateway, changeOrigin: true },
      "/registry": { target: gateway, changeOrigin: true },
    },
  },
});
