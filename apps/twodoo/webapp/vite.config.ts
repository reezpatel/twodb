import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// TwoDoo's UI in dev talks to the gateway exactly like it will in prod:
// same-origin, with /apps/twodoo/* proxied. The gateway forwards identity
// (x-twodb-*) after resolving the shared control-plane session — that IS the
// SSO: no separate login here, an unauthenticated visitor gets bounced to the
// control plane's login by the App component (same pattern as twochat).
const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";

// In dev the API proxy normally goes through the gateway (identity resolved
// there). When the gateway isn't running twodoo (e.g. a dev box where 6400 is
// busy), set TWODOO_API_TARGET to the backend's own port — the proxy then
// injects the dev identity headers itself. Prod always goes through the
// gateway; this is a dev-server-only convenience.
const directApi = process.env.TWODOO_API_TARGET;
const apiTarget = directApi ?? gateway;
const apiRewrite = directApi
  ? (p: string) => p.replace(/^\/twodoo-api/, "")
  : (p: string) => p.replace(/^\/twodoo-api/, "/apps/twodoo");
const apiHeaders = directApi
  ? {
      "x-twodb-auth-kind": "session",
      "x-twodb-workspace-id": "wks_test",
      "x-twodb-user-id": "usr_test",
      "x-twodb-space-ids": "spc_main",
    }
  : undefined;

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
    port: 6511,
    strictPort: true,
    host: true,
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: {
      // TwoDoo's own API — gateway in prod, direct-to-backend in dev when
      // TWODOO_API_TARGET is set (identity headers injected by the proxy).
      "/twodoo-api": {
        target: apiTarget,
        changeOrigin: true,
        rewrite: apiRewrite,
        headers: apiHeaders,
      },
      // Control-plane session surface (better-auth) — shared-origin SSO.
      "/api": { target: gateway, changeOrigin: true },
      // Spaces list comes from the control plane.
      "/registry": { target: gateway, changeOrigin: true },
    },
  },
});
