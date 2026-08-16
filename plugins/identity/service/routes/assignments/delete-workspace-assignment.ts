import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { typedDb } from "@twodb/shared-backend";
import type { IdentityDB } from "../../db/schema";
import { ownerAssignmentCount, ownerRoleId } from "./shared";

export function registerDeleteWorkspaceAssignment(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const requireClaim = fastify.requireClaim;
	const withWorkspace = fastify.withWorkspace;
	const db = typedDb<IdentityDB>(fastify);

	fastify.delete(
		"/workspaces/:id/assignments/:assignmentId",
		{
			preHandler: [
				withWorkspace({ entity: "workspaces", idParam: "id" }),
				requireClaim("plugin.twodb.identity:role.manage"),
			],
		},
		async (request, reply) => {
			const workspaceCtx = request.workspaceContext!;
			const { assignmentId } = request.params as { assignmentId: string };
			const target = await db
				.selectFrom("workspace_role_assignments")
				.select(["user_id", "role_id"])
				.where("id", "=", assignmentId)
				.where("workspace_id", "=", workspaceCtx.workspaceId)
				.executeTakeFirst();
			if (!target) {
				return reply.code(404).send({ error: "Assignment not found." });
			}
			const role = await db
				.selectFrom("roles")
				.select("key")
				.where("id", "=", target.role_id)
				.where("workspace_id", "=", workspaceCtx.workspaceId)
				.executeTakeFirst();
			if (role?.key === "owner") {
				const ownerId = await ownerRoleId(db, workspaceCtx.workspaceId);
				if (ownerId) {
					const count = await ownerAssignmentCount(
						db,
						workspaceCtx.workspaceId,
						ownerId,
					);
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
				workspaceId: workspaceCtx.workspaceId,
				userId: target.user_id,
				roleId: target.role_id,
			});
			return { ok: true };
		},
	);
}
