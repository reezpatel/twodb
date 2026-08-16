import { identityDb } from "../../db";
import type { FastifyInstance } from "fastify";

import type { AuthCtx } from "../../lib/auth/ctx";
import { requireAppAdmin } from "./shared";

export function registerDeleteAppAssignment(
	fastify: FastifyInstance,
	_ctx: AuthCtx,
): void {
	const db = identityDb(fastify);

	fastify.delete(
		"/apps/:appId/assignments/:assignmentId",
		async (request, reply) => {
			const { appId, assignmentId } = request.params as {
				appId: string;
				assignmentId: string;
			};
			const gate = await requireAppAdmin(appId, request);
			if (!gate.ok) return reply.code(gate.status).send(gate.body);
			const target = await db
				.selectFrom("app_role_assignments")
				.select(["user_id", "app_role_id"])
				.where("id", "=", assignmentId)
				.where("app_id", "=", appId)
				.executeTakeFirst();
			if (!target) {
				return reply.code(404).send({ error: "Assignment not found." });
			}
			await db
				.deleteFrom("app_role_assignments")
				.where("id", "=", assignmentId)
				.execute();
			fastify.bus.emit("twodb.identity.app.role.revoked", {
				appId,
				userId: target.user_id,
				appRoleId: target.app_role_id,
			});
			return { ok: true };
		},
	);
}
