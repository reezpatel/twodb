import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { deleteRow } from "../../lib/rows";
import { sectionOf } from "../sections/index";

export function registerDeleteRow(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.delete("/sections/:id/rows/:rowId", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const { rowId } = request.params as { rowId: string };
		const { hard } = request.query as { hard?: string };
		const deleted = await deleteRow(ctx.db, node, rowId, hard === "true");
		if (!deleted) return reply.code(404).send({ error: "Row not found." });
		fastify.bus.emit("io.twodb.content.row.deleted", {
			workspaceId: node.workspace_id,
			sectionId: node.id,
			rowId,
		});
		return reply.code(204).send();
	});
}
