import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { typedDb } from "@twodb/shared-backend";
import type { IdentityDB } from "../../db/schema";

export function registerGetGrants(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const withWorkspace = fastify.withWorkspace;
	const db = typedDb<IdentityDB>(fastify);

	fastify.get(
		"/grants",
		{
			preHandler: [withWorkspace({ workspaceIdQuery: "workspaceId" })],
		},
		async (request, reply) => {
			const workspaceCtx = request.workspaceContext!;
			const { entityType, entityId } = request.query as {
				entityType?: string;
				entityId?: string;
			};
			if (!entityType || !entityId) {
				return reply.code(400).send({
					error: "entityType and entityId query params are required.",
				});
			}
			const rows = await db
				.selectFrom("entity_grants")
				.innerJoin("users", "users.id", "entity_grants.user_id")
				.select([
					"entity_grants.id",
					"entity_grants.user_id",
					"entity_grants.claims",
					"entity_grants.granted_by",
					"entity_grants.created_at",
					"users.name",
					"users.email",
				])
				.where("entity_grants.workspace_id", "=", workspaceCtx.workspaceId)
				.where("entity_grants.entity_type", "=", entityType)
				.where("entity_grants.entity_id", "=", entityId)
				.execute();
			return {
				grants: rows.map((r) => ({
					id: r.id,
					user: {
						id: r.user_id,
						name: r.name,
						email: r.email,
					},
					claims: r.claims,
					grantedBy: r.granted_by,
					createdAt: r.created_at,
				})),
			};
		},
	);
}
