import { identityDb } from "../../db";
import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";

import { ownerAssignmentCount, ownerRoleId } from "./shared";

export function registerDeleteWorkspaceAssignment(
	fastify: FastifyInstance,
	_ctx: AuthCtx,
): void {
	const identityRequireClaim = fastify.identityRequireClaim;
	const db = identityDb(fastify);

	fastify.delete(
		"/workspace/assignments/:assignmentId",
		{
			preHandler: [identityRequireClaim("plugin.twodb.identity:role.manage")],
		},
		async (request, reply) => {
			const principal = request.principal!;
			const workspaceId = principal.workspaceId;
			if (!workspaceId || !principal.isWorkspaceMember) {
				return reply
					.code(403)
					.send({ error: "You are not in this workspace." });
			}
			const { assignmentId } = request.params as { assignmentId: string };
			const target = await db
				.selectFrom("workspace_role_assignments")
				.select(["user_id", "role_id"])
				.where("id", "=", assignmentId)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (!target) {
				return reply.code(404).send({ error: "Assignment not found." });
			}
			const role = await db
				.selectFrom("roles")
				.select("key")
				.where("id", "=", target.role_id)
				.where("workspace_id", "=", workspaceId)
				.executeTakeFirst();
			if (role?.key === "owner") {
				const ownerId = await ownerRoleId(db, workspaceId);
				if (ownerId) {
					const count = await ownerAssignmentCount(db, workspaceId, ownerId);
					if (count <= 1) {
						return reply.code(409).send({
							error: "Transfer ownership to someone else first.",
						});
					}
				}
			}
			await db
				.deleteFrom("workspace_role_assignments")
				.where("id", "=", assignmentId)
				.execute();
			fastify.bus.emit("twodb.identity.role.revoked", {
				workspaceId,
				userId: target.user_id,
				roleId: target.role_id,
			});
			return { ok: true };
		},
	);
}
