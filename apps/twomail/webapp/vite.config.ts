import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const gateway=process.env.TWODB_GATEWAY_URL??"http://localhost:6400";
export default defineConfig({plugins:[react(),tailwindcss()],server:{port:6503,strictPort:true,proxy:{"/apps/twomail":{target:gateway,changeOrigin:true},"/api":{target:gateway,changeOrigin:true},"/registry":{target:gateway,changeOrigin:true}}}});
