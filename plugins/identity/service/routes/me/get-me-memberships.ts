import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import type { AuthCtx } from "../../lib/auth/ctx";

export function registerGetMeMemberships(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;

	fastify.get("/me/memberships", async (request) => {
		const { userId } = request.principal as Principal;
		const orgs = await db
			.selectFrom("org_memberships")
			.innerJoin("organizations", "organizations.id", "org_memberships.org_id")
			.select([
				"organizations.id",
				"organizations.name",
				"organizations.slug",
				"organizations.created_by",
				"organizations.created_at",
				"org_memberships.is_admin",
			])
			.where("org_memberships.user_id", "=", userId)
			.execute();
		const workspaces = await db
			.selectFrom("workspace_members")
			.innerJoin(
				"workspaces",
				"workspaces.id",
				"workspace_members.workspace_id",
			)
			.innerJoin("organizations", "organizations.id", "workspaces.org_id")
			.select([
				"workspaces.id",
				"workspaces.org_id",
				"workspaces.name",
				"workspaces.slug",
				"workspaces.created_at",
				"organizations.name as org_name",
			])
			.where("workspace_members.user_id", "=", userId)
			.execute();
		return {
			orgs: orgs.map((o) => ({
				id: o.id,
				name: o.name,
				slug: o.slug,
				createdBy: o.created_by,
				createdAt: o.created_at,
				isAdmin: o.is_admin,
			})),
			workspaces: workspaces.map((w) => ({
				id: w.id,
				orgId: w.org_id,
				name: w.name,
				slug: w.slug,
				createdAt: w.created_at,
				orgName: w.org_name,
			})),
		};
	});
}
