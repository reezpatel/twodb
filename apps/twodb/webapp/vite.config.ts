import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": { target: process.env.TWODB_GATEWAY_URL ?? "http://localhost:4000", changeOrigin: true },
      "/registry": { target: process.env.TWODB_GATEWAY_URL ?? "http://localhost:4000", changeOrigin: true },
    },
  },
});
