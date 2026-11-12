import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

// TwoThing's UI talks to the Gateway exactly like it will in prod: same
// origin, /apps/twothing/* proxied, identity resolved there from the shared
// control-plane session (SSO). Camera scanning needs a secure context, so
// with DEV_HTTPS=true we serve the mkcert cert from .dev-certs/ — that's what
// makes scanning from your phone over the LAN work.
//
// TWOTHING_DIRECT=1 skips the Gateway entirely: /apps/twothing → the backend
// on :6411 (boot it with TWOTHING_DEV_WORKSPACE=… so it accepts headerless
// requests) and the webapp skips the login check. Dev convenience only.
const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";
const direct = process.env.TWOTHING_DIRECT === "1";
const backend = process.env.TWOTHING_URL ?? "http://localhost:6411";

function rootEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const f = path.resolve(__dirname, "../../../.env");
  if (!existsSync(f)) return undefined;
  return readFileSync(f, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"))?.[1].trim();
}

const devHttps = rootEnv("DEV_HTTPS") === "true" && process.env.TWOTHING_HTTP !== "1";
const certPath = path.resolve(__dirname, "../../../.dev-certs/dev.pem");
const keyPath = path.resolve(__dirname, "../../../.dev-certs/dev-key.pem");
const hasCerts = existsSync(certPath) && existsSync(keyPath);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __TWOTHING_NO_AUTH__: JSON.stringify(direct) },
  optimizeDeps: { exclude: ["zxing-wasm"] },
  server: {
    port: 6504,
    strictPort: true,
    host: true,
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: direct
      ? { "/apps/twothing": { target: backend, changeOrigin: true, rewrite: (p) => p.replace(/^\/apps\/twothing/, "") } }
      : {
          "/apps/twothing": { target: gateway, changeOrigin: true },
          // Control-plane session surface (better-auth) — shared-origin SSO.
          "/api": { target: gateway, changeOrigin: true },
        },
  },
});
