import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// TwoChat's UI in dev talks to the gateway exactly like it will in prod:
// same-origin, with /apps/twochat/* proxied. The gateway forwards identity
// (x-twodb-*) after resolving the shared control-plane session — that IS the
// SSO: no separate login here, an unauthenticated visitor gets bounced to the
// control plane's login by RequireAuth. WS upgrades to /apps/twochat/ws are
// bridged by the gateway's ws-passthrough (declared in the manifest's
// websocketPaths).
const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";

// Same DEV_HTTPS scheme as the TwoDB webapp: WebAuthn/passkey and shared
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

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 6501,
    strictPort: true,
    host: true,
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: {
      // TwoChat's own API, through the gateway (auth resolved there).
      "/twochat-api": {
        target: gateway,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/twochat-api/, "/apps/twochat"),
        // ws: true is not needed here — the chat WS connects via /apps/twochat/ws
      },
      // Control-plane session surface (better-auth) — shared-origin SSO.
      "/api": { target: gateway, changeOrigin: true },
      // Spaces list comes from the control plane.
      "/registry": { target: gateway, changeOrigin: true },
      // The gateway's app proxy also serves WS upgrades.
      "/apps/twochat/ws": { target: gateway, changeOrigin: true, ws: true },
    },
  },
});
