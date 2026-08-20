import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { getRow } from "../../lib/rows";
import { sectionOf } from "../sections/index";

export function registerGetRow(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.get("/sections/:id/rows/:rowId", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const { rowId } = request.params as { rowId: string };
		const row = await getRow(ctx.db, node, rowId);
		if (!row) return reply.code(404).send({ error: "Row not found." });
		return { row };
	});
}
