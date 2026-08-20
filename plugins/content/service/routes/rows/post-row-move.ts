import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { resolveNode } from "../../lib/resolve-node";
import { moveRow, RowError } from "../../lib/rows";
import { sendError } from "../../lib/send-error";
import { sectionOf } from "../sections/index";

export function registerPostRowMove(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.post("/sections/:id/rows/:rowId/move", async (request, reply) => {
		const node = await sectionOf(request, reply, ctx.db);
		if (!node) return reply;
		const { rowId } = request.params as { rowId: string };
		const body = request.body as { target_section_id?: string };
		if (!body.target_section_id) {
			return reply.code(400).send({ error: "target_section_id is required." });
		}
		const target = await resolveNode(
			ctx.db,
			node.workspace_id,
			body.target_section_id,
			{ sectionsOnly: true },
		);
		if (!target) {
			return reply.code(404).send({ error: "Target section not found." });
		}
		try {
			const row = await moveRow(ctx.db, node, target, rowId);
			if (!row) return reply.code(404).send({ error: "Row not found." });
			fastify.bus.emit("io.twodb.content.row.moved", {
				workspaceId: node.workspace_id,
				sectionId: node.id,
				targetSectionId: target.id,
				rowId,
			});
			return { row };
		} catch (err) {
			if (err instanceof RowError) return sendError(reply, err);
			throw err;
		}
	});
}
