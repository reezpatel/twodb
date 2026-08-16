import { identityDb } from "../../db";
import type { FastifyInstance } from "fastify";

import type { AuthCtx } from "../../lib/auth/ctx";
import { adminGate } from "./shared";

export function registerGetAdminOrgs(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const db = identityDb(fastify);
	const gate = adminGate(fastify);

	fastify.get("/admin/orgs", { preHandler: gate }, async () => {
		const orgs = await db
			.selectFrom("organizations")
			.select([
				"id",
				"name",
				"slug",
				"created_by",
				"created_at",
				"suspended_at",
			])
			.orderBy("created_at")
			.execute();
		const memberCounts = new Map<string, number>();
		const memberRows = await db
			.selectFrom("org_memberships")
			.select("org_id")
			.execute();
		for (const r of memberRows) {
			memberCounts.set(r.org_id, (memberCounts.get(r.org_id) ?? 0) + 1);
		}
		const workspaceCounts = new Map<string, number>();
		const wsRows = await db.selectFrom("workspaces").select("org_id").execute();
		for (const r of wsRows) {
			workspaceCounts.set(r.org_id, (workspaceCounts.get(r.org_id) ?? 0) + 1);
		}
		return {
			orgs: orgs.map((o) => ({
				id: o.id,
				name: o.name,
				slug: o.slug,
				createdBy: o.created_by,
				createdAt: o.created_at,
				suspendedAt: o.suspended_at,
				memberCount: memberCounts.get(o.id) ?? 0,
				workspaceCount: workspaceCounts.get(o.id) ?? 0,
			})),
		};
	});
}
