import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import type { AuthCtx } from "../../lib/auth/ctx";
import { evaluateDisable, listUserMethods } from "../../lib/users/methods";

export function registerPatchMeAuthMethod(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;

	fastify.patch("/me/auth-methods/:id", async (request, reply) => {
		const { userId } = request.principal as Principal;
		const { id } = request.params as { id: string };
		const body = request.body as { enabled?: boolean };
		if (typeof body.enabled !== "boolean") {
			return reply.code(400).send({ error: "enabled must be true or false." });
		}
		const rows = await listUserMethods(db, userId);
		const target = rows.find((m) => m.id === id);
		if (!target) {
			return reply
				.code(404)
				.send({ error: "That sign-in method was not found." });
		}
		if (!body.enabled) {
			const verdict = evaluateDisable(rows, id);
			if (!verdict.ok) return reply.code(409).send({ error: verdict.error });
		}
		await db
			.updateTable("user_auth_methods")
			.set({ enabled: body.enabled })
			.where("id", "=", id)
			.execute();
		fastify.bus.emit("twodb.identity.authmethod.configured", {
			method: target.method,
		});
		return { ok: true };
	});
}
