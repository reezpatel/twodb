import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import type { AuthCtx } from "../../lib/auth/ctx";
import { consumeCode } from "../../lib/auth/codes";
import { VERIFY_EXEMPT } from "../../../shared/constants";

export function registerPostAuthVerifyConfirm(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;

	fastify.post(
		"/auth/verify/confirm",
		VERIFY_EXEMPT,
		async (request, reply) => {
			const { userId } = request.principal as Principal;
			const body = request.body as { identifier?: string; code?: string };
			const identifier = body.identifier?.trim().toLowerCase();
			const code = body.code?.trim();
			if (!identifier || !code) {
				return reply
					.code(401)
					.send({ error: "That code didn't work. Ask for a fresh one." });
			}
			const ok = await consumeCode(db, identifier, "verify", code);
			if (!ok) {
				return reply
					.code(401)
					.send({ error: "That code didn't work. Ask for a fresh one." });
			}
			const user = await db
				.selectFrom("users")
				.select(["email", "phone"])
				.where("id", "=", userId)
				.executeTakeFirst();
			if (user?.email === identifier) {
				await db
					.updateTable("users")
					.set({ email_verified_at: new Date() })
					.where("id", "=", userId)
					.execute();
			} else if (user?.phone === identifier) {
				await db
					.updateTable("users")
					.set({ phone_verified_at: new Date() })
					.where("id", "=", userId)
					.execute();
			}
			return { ok: true };
		},
	);
}
