import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ContentCtx } from "../../lib/ctx";
import { requireWorkspace } from "../../lib/require-workspace";
import { resolveNode } from "../../lib/resolve-node";
import type { ContentNode } from "../../lib/tree";
import { registerGetSchema } from "./get-schema";
import { registerPostColumns } from "./post-columns";
import { registerPatchColumn } from "./patch-column";
import { registerDeleteColumn } from "./delete-column";

export function registerSectionRoutes(
	fastify: FastifyInstance,
	ctx: ContentCtx,
): void {
	registerGetSchema(fastify, ctx);
	registerPostColumns(fastify, ctx);
	registerPatchColumn(fastify, ctx);
	registerDeleteColumn(fastify, ctx);
}

/**
 * Shared gate for /sections/:id/* routes: workspace membership + section
 * resolution (id or identifier). Returns null after replying on failure.
 */
export async function sectionOf(
	request: FastifyRequest,
	reply: FastifyReply,
	db: ContentCtx["db"],
): Promise<ContentNode | null> {
	const workspaceId = requireWorkspace(request, reply);
	if (!workspaceId) return null;
	const { id } = request.params as { id: string };
	const node = await resolveNode(db, workspaceId, id, { sectionsOnly: true });
	if (!node) {
		await reply.code(404).send({ error: "Section not found." });
		return null;
	}
	return node;
}
