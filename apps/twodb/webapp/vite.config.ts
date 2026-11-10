import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 6500,
    strictPort: true,
    proxy: {
      "/api": { target: process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400", changeOrigin: true },
      "/registry": { target: process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400", changeOrigin: true },
      "/orchestrator": { target: process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400", changeOrigin: true },
      "/apps": { target: process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400", changeOrigin: true },
    },
  },
});
