import type { TwodbFastifyInstance } from "@twodb/contracts";
import { nodeExists } from "../lib/node";
import { requireWorkspace } from "../lib/require-workspace";
import type { FolderMatchDto } from "../../shared/types";

const FOLDER_SEARCH_TIMEOUT_MS = 10_000;
const FOLDER_MAX_RESULTS = 10;

type FolderQuery = { node_id?: string; q?: string };

export function registerPickerRoutes(fastify: TwodbFastifyInstance): void {
	fastify.get("/nodes", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		if (!fastify.nodeList) {
			return reply.code(503).send({ error: "node plugin is not available" });
		}
		return { nodes: await fastify.nodeList(workspaceId) };
	});

	fastify.get("/agents", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		if (!fastify.agentList) {
			return reply.code(503).send({ error: "agent plugin is not available" });
		}
		return { agents: await fastify.agentList(workspaceId) };
	});

	fastify.get("/folders", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { node_id: nodeId, q } = request.query as FolderQuery;
		if (!nodeId) {
			return reply.code(400).send({ error: "node_id is required" });
		}
		const query = q?.trim();
		if (!query) return { folders: [] };
		if (!fastify.nodeFindDirs) {
			return reply.code(503).send({ error: "node plugin is not available" });
		}
		if (!(await nodeExists(fastify, nodeId, workspaceId))) {
			return reply.code(404).send({ error: "node not found" });
		}

		try {
			const matches = await fastify.nodeFindDirs(nodeId, query, {
				maxResults: FOLDER_MAX_RESULTS,
				timeoutMs: FOLDER_SEARCH_TIMEOUT_MS,
			});
			const folders: FolderMatchDto[] = matches.map((match) => ({
				name: match.name,
				path: match.path,
				relative_path: match.relativePath,
			}));
			return { folders };
		} catch (error) {
			return reply.code(502).send({ error: (error as Error).message });
		}
	});
}
