import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import type { AuthCtx } from "../../lib/auth/ctx";
import { newId, typedDb } from "@twodb/shared-backend";
import type { IdentityDB } from "../../db/schema";

export function registerPostWorkspaceAssignments(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const requireClaim = fastify.requireClaim;
	const withWorkspace = fastify.withWorkspace;
	const db = typedDb<IdentityDB>(fastify);

	fastify.post(
		"/workspaces/:id/assignments",
		{
			preHandler: [
				withWorkspace({ entity: "workspaces", idParam: "id" }),
				requireClaim("plugin.twodb.identity:role.manage"),
			],
		},
		async (request, reply) => {
			const workspaceCtx = request.workspaceContext!;
			const body = request.body as { userId?: string; roleId?: string };
			if (!body.userId || !body.roleId) {
				return reply
					.code(400)
					.send({ error: "userId and roleId are required." });
			}
			const member = await db
				.selectFrom("workspace_members")
				.select("user_id")
				.where("workspace_id", "=", workspaceCtx.workspaceId)
				.where("user_id", "=", body.userId)
				.executeTakeFirst();
			if (!member) {
				return reply.code(403).send({
					error: "That user is not a member of this workspace.",
				});
			}

			let roleId = body.roleId;
			let isOwnerRole = false;
			if (!roleId.startsWith("rol-")) {
				const role = await db
					.selectFrom("roles")
					.select(["id", "key"])
					.where("workspace_id", "=", workspaceCtx.workspaceId)
					.where("key", "=", roleId)
					.executeTakeFirst();
				if (!role) {
					return reply.code(404).send({
						error: `Role "${roleId}" not found in this workspace.`,
					});
				}
				roleId = role.id;
				isOwnerRole = role.key === "owner";
			}

			const assignmentId = newId("asg");
			try {
				await db
					.insertInto("workspace_role_assignments")
					.values({
						id: assignmentId,
						workspace_id: workspaceCtx.workspaceId,
						user_id: body.userId,
						role_id: roleId,
					})
					.execute();
			} catch (err) {
				if ((err as { code?: string }).code === "23505") {
					return reply
						.code(409)
						.send({ error: "This user already holds that role." });
				}
				throw err;
			}
			fastify.bus.emit("twodb.identity.role.assigned", {
				workspaceId: workspaceCtx.workspaceId,
				userId: body.userId,
				roleId,
			});
			void isOwnerRole;
			return reply.code(201).send({ assignmentId });
		},
	);
}
