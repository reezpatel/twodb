import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// Garden's UI talks to the gateway exactly like in prod: same-origin, with
// /apps/garden/* proxied. The gateway resolves the shared control-plane
// session and forwards identity (x-twodb-*). For standalone dev point
// TWODB_GATEWAY_URL at scripts/dev-shim.ts (http://localhost:6498).
const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";

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
  resolve: {
    alias: { "@shared": path.resolve(__dirname, "../src/shared") },
    // one copy of React no matter how workspace deps resolve
    dedupe: ["react", "react-dom"],
  },
  // Webapps own 65XX (scaffold catalog: garden = 6509).
  server: {
    port: 6509,
    strictPort: true,
    host: true,
    fs: { allow: [path.resolve(__dirname, "../../..")] },
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: {
      "/apps/garden": { target: gateway, changeOrigin: true },
      "/api": { target: gateway, changeOrigin: true },
      "/registry": { target: gateway, changeOrigin: true },
    },
  },
});
