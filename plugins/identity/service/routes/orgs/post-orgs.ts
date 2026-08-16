import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import type { PluginManifest } from "../../lib/types";
import type { AuthCtx } from "../../lib/auth/ctx";
import { newId } from "@twodb/shared-backend";
import { seedWorkspaceRoles } from "../../lib/roles/roles";
import { identityManifest } from "../../lib/manifest";

export function registerPostOrgs(fastify: FastifyInstance, ctx: AuthCtx): void {
	const { db } = ctx;

	fastify.post("/orgs", async (request, reply) => {
		const { userId } = request.principal as Principal;
		const body = request.body as {
			name?: string;
			slug?: string;
		};
		if (!body.name?.trim() || !body.slug?.trim()) {
			return reply.code(400).send({ error: "Name and slug are required." });
		}
		const orgId = newId("org");
		const slug = body.slug.trim();
		try {
			await db
				.insertInto("organizations")
				.values({
					id: orgId,
					name: body.name.trim(),
					slug,
					created_by: userId,
				})
				.execute();
			await db
				.insertInto("org_memberships")
				.values({ org_id: orgId, user_id: userId, is_admin: true })
				.execute();
		} catch (err) {
			if ((err as { code?: string }).code === "23505") {
				return reply
					.code(409)
					.send({ error: "That organization slug is taken." });
			}
			throw err;
		}
		const identityCatalog = fastify.identityClaimCatalog;
		const defaultWorkspaceId = newId("wks");
		try {
			await db
				.insertInto("workspaces")
				.values({
					id: defaultWorkspaceId,
					org_id: orgId,
					name: "Main",
					slug: `${slug}-main`,
				})
				.execute();
			await db
				.insertInto("workspace_members")
				.values({
					workspace_id: defaultWorkspaceId,
					user_id: userId,
				})
				.execute();
			const roleIds = await seedWorkspaceRoles(
				db,
				defaultWorkspaceId,
				identityCatalog.all,
				[identityManifest as unknown as PluginManifest],
			);
			await db
				.insertInto("workspace_role_assignments")
				.values({
					id: newId("asg"),
					workspace_id: defaultWorkspaceId,
					user_id: userId,
					role_id: roleIds.owner,
				})
				.execute();
		} catch (err) {
			if ((err as { code?: string }).code === "23505") {
				// Org-default-workspace slug collided on a re-run; the org still
				// exists, so we keep the 201 and just skip the default workspace.
				fastify.bus.emit("twodb.identity.org.created", {
					orgId,
					ownerId: userId,
				});
				return reply.code(201).send({ orgId });
			}
			throw err;
		}
		fastify.bus.emit("twodb.identity.org.created", {
			orgId,
			ownerId: userId,
		});
		return reply.code(201).send({ orgId, defaultWorkspaceId });
	});
}
