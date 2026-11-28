import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// Fixed dev port — webapps own 65XX (twodb 6500, scaffold apps 6501+) so
// `pnpm local` can boot every app side by side without collisions.
// Dev proxies the Gateway (which forwards to TwoPin with auth headers).
//
// TWOPIN_DEV_DIRECT=1 bypasses the Gateway: proxy straight to the TwoPin
// backend and inject a fake dev identity (the headers the Gateway would
// normally add). Useful for UI work without booting the control plane —
// never enable when talking to anything but a local dev backend.
const direct = process.env.TWOPIN_DEV_DIRECT === "1";
const target = direct ? `http://localhost:${process.env.TWOPIN_PORT ?? 6415}` : (process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400");

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
    port: 6510,
    strictPort: true,
    host: true,
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: {
      // TwoPin's own API through the gateway: /api/* -> /apps/twopin/api/*.
      // TWOPIN_DEV_DIRECT=1 talks to the backend itself with forged identity headers instead.
      "/api": {
        target,
        changeOrigin: true,
        ...(direct ? {} : { rewrite: (p: string) => `/apps/twopin${p}` }),
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
    },
  },
});

