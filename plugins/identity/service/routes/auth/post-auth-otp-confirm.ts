import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { consumeCode } from "../../lib/auth/codes";
import {
	canCompleteChallenge,
	findUserByLoginIdentifier,
	getUserMethod,
	upsertUserMethod,
} from "../../lib/users/methods";
import { principalFor, startSession } from "../../lib/auth/signin";
import { PUBLIC } from "../../../shared/constants";

export function registerPostAuthOtpConfirm(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	if (ctx.mode === "email") return;
	const { db, mode } = ctx;

	fastify.post("/auth/otp/confirm", PUBLIC, async (request, reply) => {
		const body = request.body as { phone?: string; code?: string };
		const phone = body.phone?.trim();
		const code = body.code?.trim();
		if (!phone || !code) {
			return reply
				.code(401)
				.send({ error: "That code didn't work. Ask for a fresh one." });
		}
		const ok = await consumeCode(db, phone, "login", code);
		const user = ok
			? await findUserByLoginIdentifier(db, mode, phone)
			: undefined;
		if (!ok || !user) {
			return reply
				.code(401)
				.send({ error: "That code didn't work. Ask for a fresh one." });
		}
		const verdict = await canCompleteChallenge(db, user, "phone_otp", {
			mode,
		});
		if (!verdict.ok) {
			return reply
				.code(401)
				.send({ error: "That code didn't work. Ask for a fresh one." });
		}
		const own = await getUserMethod(db, user.id, "phone_otp");
		if (!own) {
			await upsertUserMethod(db, user.id, "phone_otp", {});
		}
		if (user.phone === phone && user.phone_verified_at === null) {
			await db
				.updateTable("users")
				.set({ phone_verified_at: new Date() })
				.where("id", "=", user.id)
				.execute();
		}
		await startSession(fastify, reply, db, user.id, "phone_otp");
		return { principal: await principalFor(db, user.id) };
	});
}
