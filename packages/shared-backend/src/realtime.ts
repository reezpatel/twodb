import type { FastifyInstance } from "fastify";
import type { ServerResponse } from "node:http";

const HEARTBEAT_MS = 25_000;

/**
 * Core realtime plugin: one SSE endpoint (`GET /events`, mounted by the host
 * at `/api/v1/events`) that fans every backend bus event out to connected
 * clients as `{ event, payload }` JSON frames. The frontend api-plugin
 * subscribes once and re-emits onto the frontend bus.
 *
 * Deliberately NOT fp-wrapped: fp skips the encapsulation context that route
 * prefixes live in, and the host mounts this with `{ prefix: "/api/v1" }`.
 * It still reads `fastify.bus` fine — root decorations are inherited.
 */
export const realtimePlugin = async (fastify: FastifyInstance) => {
	const clients = new Set<ServerResponse>();

	const offAny = fastify.bus.onAny((event, payload) => {
		const frame = `data: ${JSON.stringify({ event, payload })}\n\n`;
		for (const client of clients) client.write(frame);
	});

	const heartbeat = setInterval(() => {
		for (const client of clients) client.write(": ping\n\n");
	}, HEARTBEAT_MS);

	fastify.addHook("onClose", async () => {
		offAny();
		clearInterval(heartbeat);
		clients.clear();
	});

	fastify.get("/events", (request, reply) => {
		reply.hijack();
		reply.raw.writeHead(200, {
			"content-type": "text/event-stream",
			"cache-control": "no-cache",
			connection: "keep-alive",
		});
		reply.raw.write("retry: 3000\n\n");
		clients.add(reply.raw);
		request.raw.on("close", () => clients.delete(reply.raw));
	});
};
