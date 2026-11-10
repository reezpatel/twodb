import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// TwoRoute's UI in dev talks to the gateway exactly like it will in prod:
// same-origin, with /apps/tworoute/* proxied. The gateway forwards identity
// (x-twodb-*) after resolving the shared control-plane session — that IS the
// SSO: no separate login here, an unauthenticated visitor gets bounced to the
// control plane's login by RequireAuth.
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
    port: 6513,
    strictPort: true,
    host: true,
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: {
      // TwoRoute's own API, through the gateway (auth resolved there).
      "/tworoute-api": {
        target: gateway,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/tworoute-api/, "/apps/tworoute"),
      },
      // Control-plane session surface (better-auth) — shared-origin SSO.
      "/api": { target: gateway, changeOrigin: true },
      // Spaces list (for the space selector) comes from the control plane.
      "/registry": { target: gateway, changeOrigin: true },
    },
  },
});
