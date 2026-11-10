import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// Vite doesn't load the repo-root .env (it loads webapp/.env), and turbo only
// passes through TWODB_* + DEV_HTTPS — so read the root .env ourselves for
// DEV_HTTPS to make HTTPS work no matter how the dev server is launched.
function rootEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const f = path.resolve(__dirname, "../../../.env");
  if (!existsSync(f)) return undefined;
  const m = readFileSync(f, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  return m?.[1].trim();
}

const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";
// WebAuthn needs a secure context, so HTTPS is required when you browse the
// dev server by LAN IP (e.g. https://192.168.2.5:6500) instead of localhost.
// Opt in with DEV_HTTPS=true in the root .env.
const devHttps = rootEnv("DEV_HTTPS") === "true";

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(devHttps ? [basicSsl()] : [])],
  server: {
    port: 6500,
    strictPort: true,
    host: true, // listen on all interfaces so the LAN IP works
    proxy: {
      "/api": { target: gateway, changeOrigin: true },
      "/registry": { target: gateway, changeOrigin: true },
      "/orchestrator": { target: gateway, changeOrigin: true },
      "/apps": { target: gateway, changeOrigin: true },
    },
  },
});
