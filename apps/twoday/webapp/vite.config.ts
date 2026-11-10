import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Fixed dev port — scaffold webapps own 5180+ sequentially (twodb's webapp
// stays on 5173) so `pnpm local` can boot every app side by side.
export default defineConfig({ plugins: [react(), tailwindcss()], server: { port: 5181, strictPort: true } });
