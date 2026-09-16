import type { TwodbFastifyInstance } from "@twodb/contracts";
import { newId } from "@twodb/shared-backend";
import type { NodeCtx } from "../lib/ctx";
import { principalOf, requireWorkspace } from "../lib/require-workspace";
import { generateNodeSecret } from "../lib/secrets";
import { toSecretDto } from "../lib/serialize";

type NodeParams = { id: string };
type SecretParams = { id: string; secretId: string };
type SecretBody = { label?: string };

export function registerSecretRoutes(
	fastify: TwodbFastifyInstance,
	ctx: NodeCtx,
): void {
	fastify.post("/nodes/:id/secrets", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id } = request.params as NodeParams;

		const node = await ctx.db
			.selectFrom("node_nodes")
			.select("id")
			.where("id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.executeTakeFirst();
		if (!node) return reply.code(404).send({ error: "node not found" });

		const label = (request.body as SecretBody | null)?.label?.trim() || null;
		const secret = generateNodeSecret();
		const secretId = newId("nsec");

		await ctx.db
			.insertInto("node_node_secrets")
			.values({
				id: secretId,
				node_id: id,
				workspace_id: workspaceId,
				secret_hash: secret.hash,
				label,
				created_by: principalOf(request).userId,
			})
			.execute();

		const row = await ctx.db
			.selectFrom("node_node_secrets")
			.selectAll()
			.where("id", "=", secretId)
			.executeTakeFirstOrThrow();
		return reply
			.code(201)
			.send({ secret: toSecretDto(row), plaintext: secret.plaintext });
	});

	fastify.delete("/nodes/:id/secrets/:secretId", async (request, reply) => {
		const workspaceId = requireWorkspace(request, reply);
		if (!workspaceId) return reply;
		const { id, secretId } = request.params as SecretParams;

		const result = await ctx.db
			.updateTable("node_node_secrets")
			.set({ revoked_at: new Date() })
			.where("id", "=", secretId)
			.where("node_id", "=", id)
			.where("workspace_id", "=", workspaceId)
			.where("revoked_at", "is", null)
			.executeTakeFirst();
		if (result.numUpdatedRows === 0n) {
			return reply.code(404).send({ error: "secret not found" });
		}
		return { revoked: true };
	});
}
