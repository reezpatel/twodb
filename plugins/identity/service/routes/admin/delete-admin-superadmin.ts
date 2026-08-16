import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import { typedDb } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import type { IdentityDB } from "../../db/schema";
import { audit } from "../../lib/admin/admin";
import { adminGate } from "./shared";

export function registerDeleteAdminSuperadmin(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const db = typedDb<IdentityDB>(fastify);
	const gate = adminGate(fastify);

	fastify.delete(
		"/admin/superadmins/:userId",
		{ preHandler: gate },
		async (request, reply) => {
			const { userId } = request.params as { userId: string };
			const count = await db
				.selectFrom("platform_admins")
				.select((eb) => eb.fn.count<number>("user_id").as("c"))
				.executeTakeFirst();
			if (Number(count?.c ?? 0) <= 1) {
				return reply.code(409).send({
					error: "Add another superadmin first.",
				});
			}
			await db
				.deleteFrom("platform_admins")
				.where("user_id", "=", userId)
				.execute();
			await audit(fastify, {
				actor: (request.principal as Principal).userId,
				action: "superadmin.demoted",
				target: userId,
			});
			fastify.bus.emit(
				"twodb.identity.superadmin.demoted" as never,
				{
					userId,
				} as never,
			);
			return { ok: true };
		},
	);
}
