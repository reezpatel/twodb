import type { FastifyInstance } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { requireWorkspace } from "../../lib/require-workspace";
import { resolveNode } from "../../lib/resolve-node";
import { toNodeDto, toViewDto } from "../../lib/serialize";

export function registerGetNode(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.get("/nodes/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as { id: string };
		const node = await resolveNode(ctx.db, workspaceId, id);
		if (!node) return reply.code(404).send({ error: "Node not found." });
		const views =
			node.type === "section"
				? await ctx.db
						.selectFrom("content_views")
						.selectAll()
						.where("section_id", "=", node.id)
						.where("deleted", "=", false)
						.orderBy("position", "asc")
						.execute()
				: [];
		return { node: toNodeDto(node), views: views.map(toViewDto) };
	});
}
