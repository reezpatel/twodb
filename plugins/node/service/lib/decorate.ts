import type { FastifyInstance } from "fastify";
import type {
	NodeDirMatch,
	NodeFindDirsFn,
	NodeGetFn,
	NodeInvokeFn,
	NodeListFn,
	NodeStats,
	NodeStatsFn,
} from "@twodb/contracts";
import type { Kysely } from "kysely";
import type { NodeDB } from "../db/schema";
import type { NodeGateway } from "../gateway/node-gateway";

declare module "fastify" {
	interface FastifyInstance {
		nodeInvoke?: NodeInvokeFn;
		nodeList?: NodeListFn;
		nodeGet?: NodeGetFn;
		nodeFindDirs?: NodeFindDirsFn;
		nodeStats?: NodeStatsFn;
	}
}

/**
 * The node plugin's inter-plugin API. Other plugins consume these through
 * the fastify instance instead of reaching into this plugin's schema or
 * speaking the agent wire protocol themselves.
 */
export function decorateNodeFunctions(
	fastify: FastifyInstance,
	db: Kysely<NodeDB>,
	gateway: NodeGateway,
): void {
	fastify.decorate(
		"nodeInvoke",
		(nodeId: string, action: string, payload: unknown, options: unknown) =>
			gateway.callNode(nodeId, action, payload, options as never),
	);

	fastify.decorate("nodeList", async (workspaceId: string) => {
		const nodes = await db
			.selectFrom("node_nodes")
			.select(["id", "name", "status"])
			.where("workspace_id", "=", workspaceId)
			.orderBy("name", "asc")
			.execute();
		return nodes.map((node) => ({
			id: node.id,
			name: node.name,
			status: node.status,
		}));
	});

	fastify.decorate("nodeGet", async (nodeId: string, workspaceId: string) => {
		const node = await db
			.selectFrom("node_nodes")
			.select(["id", "name", "status"])
			.where("id", "=", nodeId)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		return node
			? { id: node.id, name: node.name, status: node.status }
			: undefined;
	});

	fastify.decorate(
		"nodeFindDirs",
		async (
			nodeId: string,
			query: string,
			options?: { maxResults?: number; timeoutMs?: number },
		): Promise<NodeDirMatch[]> => {
			const data = (await gateway.callNode(
				nodeId,
				"find_dir",
				{ query, maxResults: options?.maxResults },
				{ timeoutMs: options?.timeoutMs },
			)) as { matches?: NodeDirMatch[] } | undefined;
			return data?.matches ?? [];
		},
	);

	fastify.decorate(
		"nodeStats",
		async (nodeId: string): Promise<NodeStats | undefined> => {
			const node = await db
				.selectFrom("node_nodes")
				.select(["hostname", "platform", "last_heartbeat", "last_seen_at"])
				.where("id", "=", nodeId)
				.executeTakeFirst();
			if (!node) return undefined;
			const heartbeat = node.last_heartbeat;
			return {
				online: gateway.isOnline(nodeId),
				hostname: node.hostname,
				platform: node.platform,
				cpus: heartbeat?.cpus ?? null,
				loadavg: heartbeat?.loadavg ?? null,
				memoryTotal: heartbeat?.memoryTotal ?? null,
				memoryFree: heartbeat?.memoryFree ?? null,
				activity: heartbeat?.status ?? null,
				seenAt: node.last_seen_at?.toISOString() ?? null,
			};
		},
	);
}
