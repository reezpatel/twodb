import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { RowError, updateRow, type RowInput } from "../../lib/rows";
import { sendError } from "../../lib/send-error";
import { sectionOf } from "../sections/index";

export function registerPatchRow(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.patch("/sections/:id/rows/:rowId", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const { rowId } = request.params as { rowId: string };
		try {
			const row = await updateRow(
				ctx.db,
				node,
				rowId,
				(request.body ?? {}) as RowInput,
			);
			if (!row) return reply.code(404).send({ error: "Row not found." });
			fastify.bus.emit("io.twodb.content.row.updated", {
				workspaceId: node.workspace_id,
				sectionId: node.id,
				rowId,
			});
			return { row };
		} catch (err) {
			if (err instanceof RowError) return sendError(reply, err);
			throw err;
		}
	});
}
