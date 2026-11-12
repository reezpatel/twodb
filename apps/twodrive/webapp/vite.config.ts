import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Fixed dev port — webapps own 65XX (twodb 6500, scaffold apps 6501+) so
// `pnpm local` can boot every app side by side without collisions.
// Dev proxies the Gateway (which forwards to TwoDrive with auth headers).
const gateway = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 6512,
    strictPort: true,
    proxy: {
      "/apps/twodrive": { target: gateway, changeOrigin: true },
    },
  },
});
