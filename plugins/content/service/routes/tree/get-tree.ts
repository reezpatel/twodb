import type { FastifyInstance } from "fastify";
import type { Principal } from "@twodb/contracts";
import type { ContentCtx } from "../../lib/ctx";
import { requireWorkspace } from "../../lib/require-workspace";
import { toNodeDto } from "../../lib/serialize";

export function registerGetTree(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	fastify.get("/tree", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const nodes = await ctx.db
			.selectFrom("content_nodes")
			.selectAll()
			.where("workspace_id", "=", workspaceId)
			.where("deleted", "=", false)
			.orderBy("position", "asc")
			.execute();
		return { nodes: nodes.map(toNodeDto) };
	});
}

export function principalOf(request: { principal?: unknown }): Principal {
	return request.principal as Principal;
}
