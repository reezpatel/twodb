import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import { typedDb } from "@twodb/shared-backend";
import type { AuthCtx } from "../../lib/auth/ctx";
import type { IdentityDB } from "../../db/schema";
import { audit } from "../../lib/admin/admin";
import { adminGate } from "./shared";

export function registerPostAdminOrgsSuspend(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const db = typedDb<IdentityDB>(fastify);
	const gate = adminGate(fastify);

	fastify.post(
		"/admin/orgs/:id/suspend",
		{ preHandler: gate },
		async (request, reply) => {
			const { id } = request.params as { id: string };
			const body = request.body as { suspended?: boolean };
			if (typeof body.suspended !== "boolean") {
				return reply.code(400).send({
					error: "suspended must be a boolean.",
				});
			}
			const org = await db
				.selectFrom("organizations")
				.select("id")
				.where("id", "=", id)
				.executeTakeFirst();
			if (!org) return reply.code(404).send({ error: "Org not found." });
			await db
				.updateTable("organizations")
				.set({ suspended_at: body.suspended ? new Date() : null })
				.where("id", "=", id)
				.execute();
			await audit(fastify, {
				actor: (request.principal as Principal).userId,
				action: body.suspended ? "org.suspended" : "org.unsuspended",
				target: id,
				payload: { suspended: body.suspended },
			});
			fastify.bus.emit(
				"twodb.identity.org.suspended" as never,
				{
					orgId: id,
					suspended: body.suspended,
				} as never,
			);
			return { ok: true };
		},
	);
}
