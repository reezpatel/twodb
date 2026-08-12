import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

export async function registerStaticApp(app: FastifyInstance) {
	const staticDir = path.resolve(import.meta.dirname, app.config.STATIC_DIR);
	const hasStaticApp = fs.existsSync(path.join(staticDir, "index.html"));

	if (hasStaticApp) {
		await app.register(fastifyStatic, {
			root: staticDir,
			prefix: "/",
			wildcard: false,
			index: false,
		});

		app.get("/", async (_request, reply) => reply.sendFile("index.html"));
	}

	app.setNotFoundHandler(async (request, reply) => {
		const pathname = new URL(request.url, "http://localhost").pathname;

		if (pathname === "/api" || pathname.startsWith("/api/")) {
			reply.code(404);
			return { error: "not_found", message: "API route not found" };
		}

		if (
			hasStaticApp &&
			(request.method === "GET" || request.method === "HEAD") &&
			!path.extname(pathname)
		) {
			return reply.sendFile("index.html");
		}

		reply.code(404);
		return { error: "not_found", message: "Route not found" };
	});
}
