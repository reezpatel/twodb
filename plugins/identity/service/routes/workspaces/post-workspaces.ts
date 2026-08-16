import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import type { PluginManifest } from "../../lib/types";
import type { AuthCtx } from "../../lib/auth/ctx";
import { newId } from "@twodb/shared-backend";
import { seedWorkspaceRoles } from "../../lib/roles/roles";
import { identityManifest } from "../../lib/manifest";

export function registerPostWorkspaces(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;

	fastify.post("/workspaces", async (request, reply) => {
		const { userId } = request.principal as Principal;
		const body = request.body as {
			orgId?: string;
			name?: string;
			slug?: string;
		};
		if (!body.orgId || !body.name?.trim() || !body.slug?.trim()) {
			return reply
				.code(400)
				.send({ error: "orgId, name and slug are required." });
		}
		const membership = await db
			.selectFrom("org_memberships")
			.select("is_admin")
			.where("org_id", "=", body.orgId)
			.where("user_id", "=", userId)
			.executeTakeFirst();
		if (!membership?.is_admin) {
			return reply
				.code(403)
				.send({ error: "Only an organization admin can create workspaces." });
		}
		const installed =
			(
				fastify as unknown as {
					installedPluginManifests?: readonly PluginManifest[];
				}
			).installedPluginManifests ?? [];
		const allManifests = installed.includes(
			identityManifest as unknown as PluginManifest,
		)
			? installed
			: [identityManifest as unknown as PluginManifest, ...installed];
		const workspaceId = newId("wks");
		try {
			await db
				.insertInto("workspaces")
				.values({
					id: workspaceId,
					org_id: body.orgId,
					name: body.name.trim(),
					slug: body.slug.trim(),
				})
				.execute();
			await db
				.insertInto("workspace_members")
				.values({ workspace_id: workspaceId, user_id: userId })
				.execute();
			const roleIds = await seedWorkspaceRoles(
				db,
				workspaceId,
				fastify.identityClaimCatalog.all,
				allManifests,
			);
			await db
				.insertInto("workspace_role_assignments")
				.values({
					id: newId("asg"),
					workspace_id: workspaceId,
					user_id: userId,
					role_id: roleIds.owner,
				})
				.execute();
		} catch (err) {
			if ((err as { code?: string }).code === "23505") {
				return reply.code(409).send({
					error: "That workspace slug is taken in this organization.",
				});
			}
			throw err;
		}
		fastify.bus.emit("twodb.identity.workspace.created", {
			workspaceId,
			orgId: body.orgId,
		});
		fastify.bus.emit("twodb.identity.workspace.member.added", {
			workspaceId,
			userId,
		});
		fastify.bus.emit("twodb.identity.role.assigned", {
			workspaceId,
			userId,
			roleId: "owner",
		});
		return reply.code(201).send({ workspaceId });
	});
}
