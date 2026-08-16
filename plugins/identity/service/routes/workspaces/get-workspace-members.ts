import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import type { AuthCtx } from "../../lib/auth/ctx";

export function registerGetWorkspaceMembers(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;

	fastify.get("/workspaces/:id/members", async (request, reply) => {
		const { userId } = request.principal as Principal;
		const { id } = request.params as { id: string };
		const membership = await db
			.selectFrom("workspace_members")
			.select("user_id")
			.where("workspace_id", "=", id)
			.where("user_id", "=", userId)
			.executeTakeFirst();
		if (!membership) {
			return reply.code(403).send({ error: "You are not in this workspace." });
		}
		const members = await db
			.selectFrom("workspace_members")
			.innerJoin("users", "users.id", "workspace_members.user_id")
			.select([
				"users.id",
				"users.name",
				"users.email",
				"users.phone",
				"workspace_members.created_at",
			])
			.where("workspace_members.workspace_id", "=", id)
			.execute();
		return {
			members: members.map((m) => ({
				userId: m.id,
				name: m.name,
				email: m.email,
				phone: m.phone,
				joinedAt: m.created_at,
			})),
		};
	});
}
