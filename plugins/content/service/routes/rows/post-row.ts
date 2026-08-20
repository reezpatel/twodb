import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { createRow, RowError, type RowInput } from "../../lib/rows";
import { sendError } from "../../lib/send-error";
import { sectionOf } from "../sections/index";
import { principalOf } from "../tree/get-tree";

export function registerPostRow(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.post("/sections/:id/rows", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const { userId } = principalOf(request);
		try {
			const row = await createRow(
				ctx.db,
				node,
				userId,
				(request.body ?? {}) as RowInput,
			);
			fastify.bus.emit("io.twodb.content.row.created", {
				workspaceId: node.workspace_id,
				sectionId: node.id,
				rowId: row.id,
			});
			return reply.code(201).send({ row });
		} catch (err) {
			if (err instanceof RowError) return sendError(reply, err);
			throw err;
		}
	});
}
