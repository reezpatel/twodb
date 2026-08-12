import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [
		react({
			babel: {
				// styled-jsx: scoped component styles via `<style jsx>` / css``.
				// Convention lives in /AGENTS.md.
				plugins: ["styled-jsx/babel"],
			},
		}),
	],
	server: {
		port: 5173,
		strictPort: true,
	},
});
