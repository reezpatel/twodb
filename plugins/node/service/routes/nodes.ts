import type { TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import type { NodeCtx } from "../lib/ctx";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { generateNodeSecret } from "../lib/secrets";
import { toNodeDto, toSecretDto } from "../lib/serialize";

type NodeParams = { id: string };
type NodeBody = { name?: string };
type NodeInvokeBody = {
	action?: string;
	payload?: unknown;
	timeout_ms?: number;
};

const nameFrom = (body: NodeBody | null | undefined): string | null => {
	const name = body?.name?.trim();
	return name && name.length > 0 ? name : null;
};

export function registerNodeRoutes(
	fastify: TwodbFastifyInstance,
	ctx: NodeCtx,
): void {
	fastify.get("/nodes", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const nodes = await ctx.db
			.selectFrom("node_nodes")
			.selectAll()
			.where("workspace_id", "=", workspaceId)
			.orderBy("created_at", "asc")
			.execute();
		return { nodes: nodes.map(toNodeDto) };
	});

	fastify.post("/nodes", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const name = nameFrom(request.body as NodeBody);
		if (!name) return reply.code(400).send({ error: "name is required" });

		const principal = principalOf(request);
		const nodeId = newId("node");
		const secret = generateNodeSecret();

		await ctx.db
			.insertInto("node_nodes")
			.values({
				id: nodeId,
				workspace_id: workspaceId,
				name,
				created_by: principal.userId,
			})
			.execute();
		await ctx.db
			.insertInto("node_node_secrets")
			.values({
				id: newId("nsec"),
				node_id: nodeId,
				workspace_id: workspaceId,
				secret_hash: secret.hash,
				label: "initial",
				created_by: principal.userId,
			})
			.execute();

		const node = await ctx.db
			.selectFrom("node_nodes")
			.selectAll()
			.where("id", "=", nodeId)
			.executeTakeFirstOrThrow();
		return reply
			.code(201)
			.send({ node: toNodeDto(node), secret: secret.plaintext });
	});

	fastify.get("/nodes/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as NodeParams;

		const node = await ctx.db
			.selectFrom("node_nodes")
			.selectAll()
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (!node) return reply.code(404).send({ error: "node not found" });

		const secrets = await ctx.db
			.selectFrom("node_node_secrets")
			.selectAll()
			.where("node_id", "=", id)
			.orderBy("created_at", "asc")
			.execute();
		return { node: toNodeDto(node), secrets: secrets.map(toSecretDto) };
	});

	fastify.post("/nodes/:id/invoke", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as NodeParams;
		const body = (request.body ?? {}) as NodeInvokeBody;

		if (!body.action || typeof body.action !== "string") {
			return reply.code(400).send({ error: "action is required" });
		}

		const node = await ctx.db
			.selectFrom("node_nodes")
			.select("id")
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (!node) return reply.code(404).send({ error: "node not found" });
		if (!ctx.gateway.isOnline(id)) {
			return reply.code(409).send({ error: "node is offline" });
		}

		try {
			const data = await ctx.gateway.callNode(id, body.action, body.payload, {
				timeoutMs: body.timeout_ms,
			});
			return { ok: true, data: data ?? null };
		} catch (error) {
			return reply.code(502).send({ error: (error as Error).message });
		}
	});

	fastify.patch("/nodes/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as NodeParams;
		const name = nameFrom(request.body as NodeBody);
		if (!name) return reply.code(400).send({ error: "name is required" });

		const result = await ctx.db
			.updateTable("node_nodes")
			.set({ name, updated_at: new Date() })
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (result.numUpdatedRows === 0n) {
			return reply.code(404).send({ error: "node not found" });
		}
		const node = await ctx.db
			.selectFrom("node_nodes")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();
		return { node: toNodeDto(node) };
	});

	fastify.delete("/nodes/:id", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as NodeParams;

		const result = await ctx.db
			.deleteFrom("node_nodes")
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (result.numDeletedRows === 0n) {
			return reply.code(404).send({ error: "node not found" });
		}
		ctx.gateway.disconnect(id);
		return { deleted: true };
	});
}
