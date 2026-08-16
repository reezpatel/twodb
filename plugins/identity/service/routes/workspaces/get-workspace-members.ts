import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";

export function registerGetWorkspaceMembers(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;

	fastify.get("/workspace/members", async (request, reply) => {
		const principal = request.principal;
		if (!principal?.isWorkspaceMember) {
			return reply.code(403).send({ error: "You are not in this workspace." });
		}
		const workspaceId = principal.workspaceId;
		if (!workspaceId) {
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
			.where("workspace_members.workspace_id", "=", workspaceId)
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
