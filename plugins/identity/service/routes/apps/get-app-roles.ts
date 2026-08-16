import { identityDb } from "../../db";
import type { FastifyInstance } from "fastify";

import type { AuthCtx } from "../../lib/auth/ctx";
import { requireAppAdmin } from "./shared";

export function registerGetAppRoles(
	fastify: FastifyInstance,
	_ctx: AuthCtx,
): void {
	const db = identityDb(fastify);

	fastify.get("/apps/:appId/roles", async (request, reply) => {
		const { appId } = request.params as { appId: string };
		const gate = await requireAppAdmin(appId, request);
		if (!gate.ok) return reply.code(gate.status).send(gate.body);
		const roles = await db
			.selectFrom("app_roles")
			.select(["id", "key", "name", "is_system"])
			.where("app_id", "=", appId)
			.orderBy("is_system", "desc")
			.orderBy("name")
			.execute();
		const claimsRows = await db
			.selectFrom("app_role_claims")
			.innerJoin("app_roles", "app_roles.id", "app_role_claims.app_role_id")
			.select(["app_role_claims.app_role_id", "app_role_claims.claim"])
			.where("app_roles.app_id", "=", appId)
			.execute();
		const grouped = new Map<string, string[]>();
		for (const c of claimsRows) {
			const list = grouped.get(c.app_role_id) ?? [];
			list.push(c.claim);
			grouped.set(c.app_role_id, list);
		}
		return {
			roles: roles.map((r) => ({
				id: r.id,
				key: r.key,
				name: r.name,
				isSystem: r.is_system,
				claims: grouped.get(r.id) ?? [],
			})),
			catalog: gate.app.permissions,
		};
	});
}
