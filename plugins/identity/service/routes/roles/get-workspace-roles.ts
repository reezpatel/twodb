import type { FastifyInstance } from "fastify";
import type { Claim } from "@twodb/contracts";
import { typedDb } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import type { IdentityDB } from "../../db/schema";

export function registerGetWorkspaceRoles(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const withWorkspace = fastify.withWorkspace;
	const catalog = fastify.claimCatalog;
	const db = typedDb<IdentityDB>(fastify);

	fastify.get(
		"/workspaces/:id/roles",
		{
			preHandler: [withWorkspace({ entity: "workspaces", idParam: "id" })],
		},
		async (request, reply) => {
			const workspaceCtx = request.workspaceContext;
			if (!workspaceCtx?.isMember) {
				return reply
					.code(403)
					.send({ error: "You are not in this workspace." });
			}
			const rows = await db
				.selectFrom("roles")
				.select(["id", "key", "name", "description", "is_system"])
				.where("workspace_id", "=", workspaceCtx.workspaceId)
				.orderBy("is_system")
				.orderBy("name")
				.execute();

			const claimRows = await db
				.selectFrom("role_claims")
				.innerJoin("roles", "roles.id", "role_claims.role_id")
				.select(["role_claims.role_id", "role_claims.claim"])
				.where("roles.workspace_id", "=", workspaceCtx.workspaceId)
				.execute();
			const claimsByRole = new Map<string, string[]>();
			for (const c of claimRows) {
				const list = claimsByRole.get(c.role_id) ?? [];
				list.push(c.claim);
				claimsByRole.set(c.role_id, list);
			}

			return {
				roles: rows.map((r) => ({
					id: r.id,
					key: r.key,
					name: r.name,
					description: r.description,
					isSystem: r.is_system,
					claims: (claimsByRole.get(r.id) ?? []).map((c) => ({
						claim: c,
						dangling: !catalog.all.has(c as Claim),
					})),
				})),
				catalog: Array.from(catalog.all),
			};
		},
	);
}
