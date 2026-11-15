import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";
export default defineConfig({ plugins: [react(), tailwindcss()], server: { port: 6517, strictPort: true, proxy: {
      // The app's own API (REST + WS + SSE) through the gateway: /api/* -> /apps/twocontacts/api/*.
      // Auth/control-plane calls go to the console (see twodb-shared-frontend), not through this proxy.
      "/api": { target: gateway, changeOrigin: true, ws: true, rewrite: (p: string) => `/apps/twocontacts${p}` },
    } } });
