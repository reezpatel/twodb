import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import { typedDb } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import type { IdentityDB } from "../../db/schema";
import { audit } from "../../lib/admin/admin";
import { adminGate } from "./shared";

export function registerPostAdminSuperadmins(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const db = typedDb<IdentityDB>(fastify);
	const gate = adminGate(fastify);

	fastify.post(
		"/admin/superadmins",
		{ preHandler: gate },
		async (request, reply) => {
			const body = request.body as { userId?: string };
			if (!body.userId) {
				return reply.code(400).send({ error: "userId is required." });
			}
			const user = await db
				.selectFrom("users")
				.select("id")
				.where("id", "=", body.userId)
				.executeTakeFirst();
			if (!user) return reply.code(404).send({ error: "User not found." });
			await db
				.insertInto("platform_admins")
				.values({
					user_id: body.userId,
					granted_by: (request.principal as Principal).userId,
				})
				.onConflict((oc) => oc.doNothing())
				.execute();
			await audit(fastify, {
				actor: (request.principal as Principal).userId,
				action: "superadmin.promoted",
				target: body.userId,
			});
			fastify.bus.emit(
				"twodb.identity.superadmin.promoted" as never,
				{
					userId: body.userId,
				} as never,
			);
			return { ok: true };
		},
	);
}
