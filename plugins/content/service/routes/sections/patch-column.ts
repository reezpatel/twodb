import type { FastifyInstance } from "fastify";
import type { ContentColumnConfig } from "@twodb/contracts";
import type { ContentCtx } from "../../lib/ctx";
import { ColumnError, updateColumn } from "../../lib/columns/columns";
import { sendError } from "../../lib/send-error";
import { sectionOf } from "./index";

export function registerPatchColumn(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.patch("/sections/:id/columns/:columnId", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const { columnId } = request.params as { columnId: string };
		const body = request.body as {
			name?: string;
			type?: string;
			options?: ContentColumnConfig["options"];
			relation?: ContentColumnConfig["relation"];
			position?: number;
		};
		try {
			const column = await ctx.db
				.transaction()
				.execute((trx) => updateColumn(trx, node, columnId, body));
			fastify.bus.emit("io.twodb.content.column.changed", {
				workspaceId: node.workspace_id,
				sectionId: node.id,
				columnId,
			});
			return { column: { ...column, mandatory: false } };
		} catch (err) {
			if (err instanceof ColumnError) return sendError(reply, err);
			throw err;
		}
	});
}
