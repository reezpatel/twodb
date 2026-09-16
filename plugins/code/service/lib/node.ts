import type { TwodbFastifyInstance } from "@twodb/contracts";

/** Workspace-scoped node check via the node plugin's decorated functions. */
export async function nodeExists(
	fastify: TwodbFastifyInstance,
	nodeId: string,
	workspaceId: string,
): Promise<boolean> {
	if (!fastify.nodeGet) {
		throw new Error("node plugin functions are not available");
	}
	return Boolean(await fastify.nodeGet(nodeId, workspaceId));
}
