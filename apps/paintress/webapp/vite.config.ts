import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// Paintress' UI talks to the gateway exactly like in prod: same-origin, with
// /apps/paintress/* proxied (REST + the board WebSocket). The gateway resolves
// the shared control-plane session and forwards identity (x-twodb-*).
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
  resolve: { alias: { "@shared": path.resolve(__dirname, "../src/shared") } },
  // Webapp fixed dev port — webapps own 65XX.
  server: {
    port: 6507,
    strictPort: true,
    host: true,
    fs: { allow: [path.resolve(__dirname, "../../..")] },
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
    proxy: {
      "/paintress-api": {
        target: gateway,
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/paintress-api/, "/apps/paintress"),
      },
      "/api": { target: gateway, changeOrigin: true },
      "/registry": { target: gateway, changeOrigin: true },
    },
  },
});
