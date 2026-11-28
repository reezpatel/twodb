import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

// Fixed dev port — webapps own 65XX (twodb 6500, scaffold apps 6501+) so
// `pnpm local` can boot every app side by side without collisions.

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
    port: 6505,
    strictPort: true,
    host: true,
    ...(devHttps && hasCerts ? { https: { cert: readFileSync(certPath), key: readFileSync(keyPath) } } : {}),
  },
});

