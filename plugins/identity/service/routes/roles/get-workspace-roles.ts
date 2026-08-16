import { identityDb } from "../../db";
import type { FastifyInstance } from "fastify";
import type { Claim } from "@twodb/contracts";

import type { AuthCtx } from "../../lib/auth/ctx";

export function registerGetWorkspaceRoles(
	fastify: FastifyInstance,
	_ctx: AuthCtx,
): void {
	const identityCatalog = fastify.identityClaimCatalog;
	const db = identityDb(fastify);

	fastify.get("/workspace/roles", async (request, reply) => {
		const principal = request.principal!;
		if (!principal.isWorkspaceMember) {
			return reply.code(403).send({ error: "You are not in this workspace." });
		}
		const workspaceId = principal.workspaceId!;
		const rows = await db
			.selectFrom("roles")
			.select(["id", "key", "name", "description", "is_system"])
			.where("workspace_id", "=", workspaceId)
			.orderBy("is_system")
			.orderBy("name")
			.execute();

		const claimRows = await db
			.selectFrom("role_claims")
			.innerJoin("roles", "roles.id", "role_claims.role_id")
			.select(["role_claims.role_id", "role_claims.claim"])
			.where("roles.workspace_id", "=", workspaceId)
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
					dangling: !identityCatalog.all.has(c as Claim),
				})),
			})),
			catalog: Array.from(identityCatalog.all),
		};
	});
}
