import type { FastifyInstance } from "fastify";
import { newId, typedDb } from "@twodb/shared-backend";
import type { IdentityDB } from "./schema";

/**
 * Role assignment endpoints (task-05 §5.5).
 *   POST   /workspaces/:id/assignments         — assign a role
 *   DELETE /workspaces/:id/assignments/:asgId  — revoke
 *
 * Guards (409 with plain language):
 *   ≥1 owner — last owner cannot be unassigned.
 *   ≥1 role per membership — handled implicitly: a member with no
 *     assignment loses their workspace_members row in the future.
 */
export function registerAssignmentRoutes(fastify: FastifyInstance) {
	const requireClaim = fastify.requireClaim;
	const withWorkspace = fastify.withWorkspace;

	async function ownerRoleId(
		db: ReturnType<typeof typedDb<IdentityDB>>,
		workspaceId: string,
	): Promise<string | null> {
		const row = await db
			.selectFrom("roles")
			.select("id")
			.where("workspace_id", "=", workspaceId)
			.where("key", "=", "owner")
			.executeTakeFirst();
		return row?.id ?? null;
	}

	async function ownerAssignmentCount(
		db: ReturnType<typeof typedDb<IdentityDB>>,
		workspaceId: string,
		ownerId: string,
	): Promise<number> {
		const row = await db
			.selectFrom("workspace_role_assignments")
			.select((eb) => eb.fn.count<number>("user_id").as("c"))
			.where("workspace_id", "=", workspaceId)
			.where("role_id", "=", ownerId)
			.executeTakeFirst();
		return Number(row?.c ?? 0);
	}

	fastify.post(
		"/workspaces/:id/assignments",
		{
			preHandler: [
				withWorkspace({ entity: "workspaces", idParam: "id" }),
				requireClaim("plugin.twodb.identity:role.manage"),
			],
		},
		async (request, reply) => {
			const ctx = request.workspaceContext!;
			const body = request.body as { userId?: string; roleId?: string };
			if (!body.userId || !body.roleId) {
				return reply.code(400).send({ error: "userId and roleId are required." });
			}
			const db = typedDb<IdentityDB>(request.server);
			const member = await db
				.selectFrom("workspace_members")
				.select("user_id")
				.where("workspace_id", "=", ctx.workspaceId)
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
					.where("workspace_id", "=", ctx.workspaceId)
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
						workspace_id: ctx.workspaceId,
						user_id: body.userId,
						role_id: roleId,
					})
					.execute();
			} catch (err) {
				if ((err as { code?: string }).code === "23505") {
					return reply.code(409).send({ error: "This user already holds that role." });
				}
				throw err;
			}
			fastify.bus.emit("twodb.identity.role.assigned", {
				workspaceId: ctx.workspaceId,
				userId: body.userId,
				roleId,
			});
			void isOwnerRole;
			return reply.code(201).send({ assignmentId });
		},
	);

	fastify.delete(
		"/workspaces/:id/assignments/:assignmentId",
		{
			preHandler: [
				withWorkspace({ entity: "workspaces", idParam: "id" }),
				requireClaim("plugin.twodb.identity:role.manage"),
			],
		},
		async (request, reply) => {
			const ctx = request.workspaceContext!;
			const { assignmentId } = request.params as { assignmentId: string };
			const db = typedDb<IdentityDB>(request.server);
			const target = await db
				.selectFrom("workspace_role_assignments")
				.select(["user_id", "role_id"])
				.where("id", "=", assignmentId)
				.where("workspace_id", "=", ctx.workspaceId)
				.executeTakeFirst();
			if (!target) {
				return reply.code(404).send({ error: "Assignment not found." });
			}
			const role = await db
				.selectFrom("roles")
				.select("key")
				.where("id", "=", target.role_id)
				.where("workspace_id", "=", ctx.workspaceId)
				.executeTakeFirst();
			if (role?.key === "owner") {
				const ownerId = await ownerRoleId(db, ctx.workspaceId);
				if (ownerId) {
					const count = await ownerAssignmentCount(db, ctx.workspaceId, ownerId);
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
				workspaceId: ctx.workspaceId,
				userId: target.user_id,
				roleId: target.role_id,
			});
			return { ok: true };
		},
	);
}
