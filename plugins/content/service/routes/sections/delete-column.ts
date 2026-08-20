import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { ColumnError, removeColumn } from "../../lib/columns/columns";
import { sendError } from "../../lib/send-error";
import { sectionOf } from "./index";

export function registerDeleteColumn(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.delete("/sections/:id/columns/:columnId", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const { columnId } = request.params as { columnId: string };
		try {
			await ctx.db
				.transaction()
				.execute((trx) => removeColumn(trx, node, columnId));
		} catch (err) {
			if (err instanceof ColumnError) return sendError(reply, err);
			throw err;
		}
		fastify.bus.emit("io.twodb.content.column.removed", {
			workspaceId: node.workspace_id,
			sectionId: node.id,
			columnId,
		});
		return reply.code(204).send();
	});
}
