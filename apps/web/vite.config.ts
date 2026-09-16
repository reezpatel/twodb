import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// HTTPS dev mode (TWODB_WEB_HTTPS=1): serves the dev server over TLS so the
// origin is a secure context and WebAuthn (admin passkeys) works when
// browsing via LAN hostname/IP instead of localhost. Generates a self-signed
// cert with SANs for localhost, the machine hostname (+ .local mDNS name),
// and all LAN IPv4 addresses into ../../.work/certs/ (gitignored).
//
// NOTE for WebAuthn: passkeys bind to the exact origin hostname, and rpID
// must be a hostname (IPs are rejected). Browse via the hostname and set
// TWODB_ADMIN_RP_ID / TWODB_ADMIN_ORIGIN in .env to match.

const certsDir = path.resolve(import.meta.dirname, "../../.work/certs");
const certPath = path.join(certsDir, "dev.crt");
const keyPath = path.join(certsDir, "dev.key");

async function ensureDevCert(): Promise<void> {
	if (fs.existsSync(certPath) && fs.existsSync(keyPath)) return;

	const selfsigned = (await import("selfsigned")).default;

	const dnsNames = ["localhost", os.hostname(), `${os.hostname()}.local`];
	const ipAddrs = ["127.0.0.1"];
	for (const addresses of Object.values(os.networkInterfaces())) {
		for (const address of addresses ?? []) {
			if (address.family === "IPv4" && !address.internal) {
				ipAddrs.push(address.address);
			}
		}
	}

	const pems = await selfsigned.generate(
		[{ name: "commonName", value: "twodb-dev" }],
		{
			notAfterDate: new Date(Date.now() + 825 * 24 * 3600_000),
			keySize: 2048,
			extensions: [
				{
					name: "subjectAltName",
					altNames: [
						...dnsNames.map((value) => ({ type: 2 as const, value })),
						...ipAddrs.map((ip) => ({ type: 7 as const, ip })),
					],
				},
			],
		},
	);

	fs.mkdirSync(certsDir, { recursive: true });
	fs.writeFileSync(certPath, pems.cert);
	fs.writeFileSync(keyPath, pems.private);
	console.log(
		`[vite] generated self-signed dev cert (SANs: ${[...dnsNames, ...ipAddrs].join(", ")})`,
	);
}

// Load the repo-root .env (same file the api reads) so TWODB_WEB_HTTPS &
// friends work there; process.env still wins when set explicitly.
const rootEnv = loadEnv(
	"development",
	path.resolve(import.meta.dirname, "../.."),
	"",
);
const useHttps =
	process.env.TWODB_WEB_HTTPS === "1" || rootEnv.TWODB_WEB_HTTPS === "1";
if (useHttps) await ensureDevCert();

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
		// Dev server is reachable over LAN (https via TWODB_WEB_HTTPS=1);
		// vite's default host check would 403 divine/divine.local.
		allowedHosts: true,
		https:
			useHttps && fs.existsSync(certPath) && fs.existsSync(keyPath)
				? {
						key: fs.readFileSync(keyPath),
						cert: fs.readFileSync(certPath),
					}
				: undefined,
		proxy: {
			"/api": {
				target: "http://localhost:3001",
				changeOrigin: true,
				ws: true,
			},
		},
	},
});
