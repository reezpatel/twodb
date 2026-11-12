import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 6510,
    strictPort: true,
    proxy: {
      "/apps/twopin": {
        target,
        changeOrigin: true,
        ...(direct ? { rewrite: (path: string) => path.replace(/^\/apps\/twopin/, "") || "/" } : {}),
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
