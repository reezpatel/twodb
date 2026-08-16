import { identityDb } from "../../db";
import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { newId } from "@twodb/shared-backend";
import type { IdentifierMode, IdentityDB } from "../../db/schema";

export function registerPostWorkspaceMembers(
	fastify: FastifyInstance,
	_ctx: AuthCtx,
): void {
	const identityRequireClaim = fastify.identityRequireClaim;
	const db = identityDb(fastify);

	fastify.post(
		"/workspace/members",
		{
			preHandler: [identityRequireClaim("plugin.twodb.identity:member.invite")],
		},
		async (request, reply) => {
			const principal = request.principal!;
			const workspaceId = principal.workspaceId;
			if (!workspaceId || !principal.isWorkspaceMember) {
				return reply
					.code(403)
					.send({ error: "You are not in this workspace." });
			}
			const inviter = principal;
			const mode = (
				request.server as unknown as {
					config: { TWODB_IDENTIFIER: IdentifierMode };
				}
			).config.TWODB_IDENTIFIER;
			const body = request.body as {
				identifier?: string;
				role?: string;
			};
			if (!body.identifier) {
				return reply.code(400).send({ error: "identifier is required." });
			}
			const identifier = body.identifier.trim().toLowerCase();
			const roleKey = (body.role ?? "guest").toLowerCase();

			let userId: string;
			const existing = await db
				.selectFrom("users")
				.select("id")
				.where((eb) =>
					mode === "email+phone"
						? eb.or([
								eb("identifier", "=", identifier),
								eb("phone", "=", identifier),
							])
						: eb("identifier", "=", identifier),
				)
				.executeTakeFirst();
			if (existing) {
				userId = existing.id;
			} else {
				userId = newId("usr");
				await db
					.insertInto("users")
					.values({
						id: userId,
						identifier,
						email: mode === "phone" ? null : identifier,
						phone:
							mode !== "phone" && identifier.includes("@") ? null : identifier,
						name: body.identifier,
					})
					.execute();
			}

			await db
				.insertInto("workspace_members")
				.values({ workspace_id: workspaceId, user_id: userId })
				.onConflict((oc) => oc.doNothing())
				.execute();

			const role = await db
				.selectFrom("roles")
				.select("id")
				.where("workspace_id", "=", workspaceId)
				.where("key", "=", roleKey)
				.executeTakeFirst();
			if (!role) {
				return reply
					.code(404)
					.send({ error: `Role "${roleKey}" not found in this workspace.` });
			}
			await db
				.insertInto("workspace_role_assignments")
				.values({
					id: newId("asg"),
					workspace_id: workspaceId,
					user_id: userId,
					role_id: role.id,
					assigned_by: inviter.userId,
				})
				.onConflict((oc) => oc.doNothing())
				.execute();

			fastify.bus.emit("twodb.identity.workspace.member.added", {
				workspaceId,
				userId,
			});
			fastify.bus.emit("twodb.identity.role.assigned", {
				workspaceId,
				userId,
				roleId: role.id,
			});
			return reply.code(201).send({ userId, roleKey });
		},
	);
}
