import type { FastifyReply } from "fastify";

/** Maps ColumnError/RowError-style `{ status }` errors to HTTP responses. */
export function sendError(reply: FastifyReply, err: unknown): FastifyReply {
	const status = (err as { status?: number }).status;
	if (typeof status === "number") {
		return reply.code(status).send({ error: (err as Error).message });
	}
	throw err;
}
