import { identityDb } from "../../db";
import type { FastifyInstance } from "fastify";
import { newId } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import { requireAppAdmin } from "./shared";

export function registerPostAppAssignments(
	fastify: FastifyInstance,
	_ctx: AuthCtx,
): void {
	const db = identityDb(fastify);

	fastify.post("/apps/:appId/assignments", async (request, reply) => {
		const { appId } = request.params as { appId: string };
		const gate = await requireAppAdmin(appId, request);
		if (!gate.ok) return reply.code(gate.status).send(gate.body);
		const body = request.body as { userId?: string; appRoleId?: string };
		if (!body.userId || !body.appRoleId) {
			return reply
				.code(400)
				.send({ error: "userId and appRoleId are required." });
		}
		const role = await db
			.selectFrom("app_roles")
			.select("id")
			.where("id", "=", body.appRoleId)
			.where("app_id", "=", appId)
			.executeTakeFirst();
		if (!role) {
			return reply.code(404).send({ error: "App role not found in this app." });
		}
		const assignmentId = newId("ara");
		try {
			await db
				.insertInto("app_role_assignments")
				.values({
					id: assignmentId,
					app_id: appId,
					user_id: body.userId,
					app_role_id: body.appRoleId,
				})
				.execute();
		} catch (err) {
			if ((err as { code?: string }).code === "23505") {
				return reply
					.code(409)
					.send({ error: "User already holds that role in this app." });
			}
			throw err;
		}
		fastify.bus.emit("twodb.identity.app.role.assigned", {
			appId,
			userId: body.userId,
			appRoleId: body.appRoleId,
		});
		return reply.code(201).send({ assignmentId });
	});
}
