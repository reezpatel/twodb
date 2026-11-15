import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// Dispatch's UI talks to the gateway exactly like it will in prod:
// same-origin, with /apps/dispatch/* proxied (auth resolved there, same
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
    port: 6514,
    strictPort: true,
    host: true,
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: {
      // The app's own API (REST + WS + SSE) through the gateway: /api/* -> /apps/dispatch/api/*.
      // Auth/control-plane calls go to the console (see twodb-shared-frontend), not through this proxy.
      "/api": { target: gateway, changeOrigin: true, ws: true, rewrite: (p: string) => `/apps/dispatch${p}` },
    },
  },
});
