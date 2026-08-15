import type { FastifyInstance } from "fastify";
import { typedDb, newId } from "@twodb/shared-backend";
import type {
	IdentifierMode,
	IdentityDB,
} from "./schema";

/**
 * Task-05 §5.6 + task-06 §6.5: invite a user by identifier into the
 * workspace. Creates the user row if missing, attaches the membership
 * row, and assigns the requested role (default "guest" for outside
 * invites). Emits member.added + role.assigned.
 *
 * The body can be { identifier, role } or { identifier } (default role).
 * Caller must hold `member.invite` (manager / owner in practice).
 */
export function registerMemberRoutes(fastify: FastifyInstance) {
	const withWorkspace = fastify.withWorkspace;
	const requireClaim = fastify.requireClaim;

	fastify.post(
		"/workspaces/:id/members",
		{
			preHandler: [
				withWorkspace({ entity: "workspaces", idParam: "id" }),
				requireClaim("plugin.twodb.identity:member.invite"),
			],
		},
		async (request, reply) => {
			const ctx = request.workspaceContext!;
			const inviter = request.principal!;
			const mode = (request.server as unknown as { config: { TWODB_IDENTIFIER: IdentifierMode } })
				.config.TWODB_IDENTIFIER;
			const body = request.body as {
				identifier?: string;
				role?: string;
			};
			if (!body.identifier) {
				return reply.code(400).send({ error: "identifier is required." });
			}
			const identifier = body.identifier.trim().toLowerCase();
			const roleKey = (body.role ?? "guest").toLowerCase();

			const db = typedDb<IdentityDB>(request.server);
			let userId: string;
			const existing = await db
				.selectFrom("users")
				.select("id")
				.where((eb) =>
					mode === "email+phone"
						? eb.or([eb("identifier", "=", identifier), eb("phone", "=", identifier)])
						: eb("identifier", "=", identifier),
				)
				.executeTakeFirst();
			if (existing) {
				userId = existing.id;
			} else {
				userId = newId("usr");
				const identifierColumn = mode === "phone" ? null : identifier;
				await db
					.insertInto("users")
					.values({
						id: userId,
						identifier,
						email: mode === "phone" ? null : identifier,
						phone: mode !== "phone" && identifier.includes("@") ? null : identifier,
						name: body.identifier,
					})
					.execute();
			}

			await db
				.insertInto("workspace_members")
				.values({ workspace_id: ctx.workspaceId, user_id: userId })
				.onConflict((oc) => oc.doNothing())
				.execute();

			const role = await db
				.selectFrom("roles")
				.select("id")
				.where("workspace_id", "=", ctx.workspaceId)
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
					workspace_id: ctx.workspaceId,
					user_id: userId,
					role_id: role.id,
					assigned_by: inviter.userId,
				})
				.onConflict((oc) => oc.doNothing())
				.execute();

			fastify.bus.emit("twodb.identity.workspace.member.added", {
				workspaceId: ctx.workspaceId,
				userId,
			});
			fastify.bus.emit("twodb.identity.role.assigned", {
				workspaceId: ctx.workspaceId,
				userId,
				roleId: role.id,
			});
			return reply.code(201).send({ userId, roleKey });
		},
	);
}
