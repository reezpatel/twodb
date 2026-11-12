import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// TwoPlan's UI talks to the gateway same-origin: /twoplan-api/* -> /apps/twoplan/*.
// Identity (x-twodb-*) is resolved by the gateway from the shared control-plane session (SSO).
const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";

function rootEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const f = path.resolve(__dirname, "../../../.env");
  if (!existsSync(f)) return undefined;
  return readFileSync(f, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"))?.[1].trim();
}
const devHttps = rootEnv("DEV_HTTPS") === "true";
const certPath = path.resolve(__dirname, "../../../.dev-certs/dev.pem");
const keyPath = path.resolve(__dirname, "../../../.dev-certs/dev-key.pem");
const hasCerts = existsSync(certPath) && existsSync(keyPath);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 6516,
    strictPort: true,
    host: true,
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: {
      "/twoplan-api": { target: gateway, changeOrigin: true, rewrite: (p) => p.replace(/^\/twoplan-api/, "/apps/twoplan") },
      "/api": { target: gateway, changeOrigin: true },
      "/registry": { target: gateway, changeOrigin: true },
    },
  },
});
