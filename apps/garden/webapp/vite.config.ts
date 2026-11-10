import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Fixed dev port — webapps own 65XX (twodb 6500, scaffold apps 6501+) so
// `pnpm local` can boot every app side by side without collisions.
export default defineConfig({ plugins: [react(), tailwindcss()], server: { port: 6509, strictPort: true } });
