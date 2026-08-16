import { identityDb } from "../../db";
import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";


export function registerDeleteGrant(
	fastify: FastifyInstance,
	_ctx: AuthCtx,
): void {
	const identityRequireClaim = fastify.identityRequireClaim;
	const db = identityDb(fastify);

	fastify.delete(
		"/grants/:id",
		{
			preHandler: [identityRequireClaim("plugin.twodb.identity:role.manage")],
		},
		async (request, reply) => {
			const principal = request.principal!;
			const workspaceId = principal.workspaceId;
			if (!workspaceId || !principal.isWorkspaceMember) {
				return reply
					.code(403)
					.send({ error: "You are not in this workspace." });
			}
			const { id } = request.params as { id: string };
			const target = await db
				.selectFrom("entity_grants")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirst();
			if (!target) {
				return reply.code(404).send({ error: "Grant not found." });
			}
			if (target.workspace_id !== workspaceId) {
				return reply
					.code(403)
					.send({ error: "Grant belongs to a different workspace." });
			}
			await db.deleteFrom("entity_grants").where("id", "=", id).execute();
			fastify.bus.emit("twodb.identity.entity.revoked", {
				workspaceId: target.workspace_id,
				entityType: target.entity_type,
				entityId: target.entity_id,
				userId: target.user_id,
			});
			return { ok: true };
		},
	);
}
