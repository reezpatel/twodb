import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { typedDb } from "@twodb/shared-backend";
import type { IdentityDB } from "../../db/schema";

export function registerDeleteGrant(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const withWorkspace = fastify.withWorkspace;
	const requireClaim = fastify.requireClaim;
	const db = typedDb<IdentityDB>(fastify);

	fastify.delete(
		"/grants/:id",
		{
			preHandler: [
				withWorkspace({ workspaceIdBody: "workspaceId" }),
				requireClaim("plugin.twodb.identity:role.manage"),
			],
		},
		async (request, reply) => {
			const workspaceCtx = request.workspaceContext!;
			const { id } = request.params as { id: string };
			const target = await db
				.selectFrom("entity_grants")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirst();
			if (!target) {
				return reply.code(404).send({ error: "Grant not found." });
			}
			if (target.workspace_id !== workspaceCtx.workspaceId) {
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
