import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// Toolkit's UI talks to the gateway exactly like it will in prod: same-origin,
// with /apps/toolkit/* proxied. The gateway resolves the shared control-plane
// session and forwards identity (x-twodb-*) — that IS the SSO.
const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";

// Same DEV_HTTPS scheme as the other app webapps: WebAuthn/passkey and shared
// cookies want a stable secure origin, so when DEV_HTTPS=true serve the
// mkcert-trusted cert from .dev-certs/ (run tools/dev-certs.sh once).
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

// TOOLKIT_DEV_DIRECT=1 bypasses the Gateway: proxy straight to the Toolkit
// backend and inject a fake dev identity. UI work only — never with a
// non-local backend.
const direct = process.env.TOOLKIT_DEV_DIRECT === "1";
const target = direct ? `http://localhost:${process.env.TOOLKIT_PORT ?? 6418}` : gateway;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Webapps own 65XX (catalog: toolkit = 6518).
    port: 6518,
    strictPort: true,
    host: true,
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: {
      // Toolkit's own API, through the gateway (auth resolved there).
      "/apps/toolkit": {
        target,
        changeOrigin: true,
        // ws: true is NOT needed here: /events/stream is SSE (plain HTTP).
        ...(direct ? { rewrite: (p) => p.replace(/^\/apps\/toolkit/, "") || "/" } : {}),
        configure: direct
          ? (proxy) => {
              proxy.on("proxyReq", (proxyReq) => {
                proxyReq.setHeader("x-twodb-auth-kind", "session");
                proxyReq.setHeader("x-twodb-workspace-id", "ws_dev");
                proxyReq.setHeader("x-twodb-user-id", "user_dev");
              });
            }
          : undefined,
      },
      // Agent catalog for the access picker — artisan's own /agents, same
      // gateway session (same SSO as everything else).
      "/apps/artisan": direct ? undefined : { target: gateway, changeOrigin: true },
      // Control-plane session surface (better-auth) — shared-origin SSO.
      "/api": { target: gateway, changeOrigin: true },
      // Spaces list (for the space selector) comes from the control plane.
      "/registry": { target: gateway, changeOrigin: true },
    },
  },
});
