import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { requireWorkspace } from "../../lib/require-workspace";
import { resolveNode } from "../../lib/resolve-node";
import { toNodeDto } from "../../lib/serialize";
import { isSelfOrAncestor } from "../../lib/tree";

export function registerPostNodeMove(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.post("/nodes/:id/move", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as { id: string };
		const body = request.body as {
			parent_id?: string | null;
			position?: number;
		};
		const parentId = body.parent_id ?? null;
		const node = await resolveNode(ctx.db, workspaceId, id);
		if (!node) return reply.code(404).send({ error: "Node not found." });

		if (parentId) {
			if (await isSelfOrAncestor(ctx.db, parentId, node.id)) {
				return reply
					.code(400)
					.send({
						error: "Cannot move a folder into itself or its descendant.",
					});
			}
			const parent = await ctx.db
				.selectFrom("content_nodes")
				.select(["id", "type", "deleted"])
				.where("id", "=", parentId)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!parent || parent.deleted || parent.type !== "folder") {
				return reply
					.code(400)
					.send({ error: "Target parent must be a live folder." });
			}
		}

		const updated = await ctx.db
			.updateTable("content_nodes")
			.set({
				parent_id: parentId,
				...(body.position !== undefined ? { position: body.position } : {}),
				updated_at: new Date(),
			})
			.where("id", "=", node.id)
			.returningAll()
			.executeTakeFirstOrThrow();
		fastify.bus.emit("io.twodb.content.node.moved", {
			workspaceId,
			nodeId: node.id,
			parentId,
		});
		return { node: toNodeDto(updated) };
	});
}
