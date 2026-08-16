import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { issueCode } from "../../lib/auth/codes";
import {
	canOfferChallenge,
	findUserByLoginIdentifier,
	getUserMethod,
} from "../../lib/users/methods";
import { OTP_TTL_MS, PUBLIC } from "../../../shared/constants";

export function registerPostAuthOtp(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	if (ctx.mode === "email") return;
	const { db, mode } = ctx;

	fastify.post("/auth/otp", PUBLIC, async (request, _reply) => {
		const body = request.body as { phone?: string };
		const phone = body.phone?.trim();
		if (!phone) return { ok: true };
		const user = await findUserByLoginIdentifier(db, mode, phone);
		const offer = await canOfferChallenge(db, "phone_otp", { mode });
		if (!offer.ok) return { ok: true };
		if (user) {
			const own = await getUserMethod(db, user.id, "phone_otp");
			if (own && !own.enabled) return { ok: true };
		}
		const code = await issueCode(db, phone, "login", "otp", OTP_TTL_MS);
		await fastify.texter.send({
			to: phone,
			text: `Your twodb code: ${code}. It works once, for 10 minutes.`,
		});
		return { ok: true };
	});
}
