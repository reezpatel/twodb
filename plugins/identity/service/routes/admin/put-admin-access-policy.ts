import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import { typedDb } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import type { IdentityDB } from "../../db/schema";
import { audit } from "../../lib/admin/admin";
import { adminGate } from "./shared";

export function registerPutAdminAccessPolicy(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const db = typedDb<IdentityDB>(fastify);
	const gate = adminGate(fastify);

	fastify.put(
		"/admin/access-policy",
		{ preHandler: gate },
		async (request, reply) => {
			const body = request.body as {
				require_verified?: boolean;
			};
			if (typeof body.require_verified !== "boolean") {
				return reply.code(400).send({
					error: "require_verified must be a boolean.",
				});
			}
			await db
				.insertInto("deployment_settings")
				.values({
					key: "require_verified",
					value: body.require_verified,
				})
				.onConflict((oc) =>
					oc.column("key").doUpdateSet({ value: body.require_verified }),
				)
				.execute();
			await audit(fastify, {
				actor: (request.principal as Principal).userId,
				action: "gate.toggled",
				target: "require_verified",
				payload: { require_verified: body.require_verified },
			});
			fastify.bus.emit(
				"twodb.identity.admin.action" as never,
				{
					action: "gate.toggled",
					require_verified: body.require_verified,
				} as never,
			);
			return { ok: true };
		},
	);
}
