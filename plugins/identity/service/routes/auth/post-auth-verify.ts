import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import type { AuthCtx } from "../../lib/auth/ctx";
import { issueCode } from "../../lib/auth/codes";
import {
	LINK_TTL_MS,
	OTP_TTL_MS,
	VERIFY_EXEMPT,
} from "../../../shared/constants";

export function registerPostAuthVerify(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;

	fastify.post("/auth/verify", VERIFY_EXEMPT, async (request, reply) => {
		const { userId } = request.principal as Principal;
		const body = request.body as { identifier?: string };
		const identifier = body.identifier?.trim().toLowerCase();
		const user = await db
			.selectFrom("users")
			.select(["email", "phone"])
			.where("id", "=", userId)
			.executeTakeFirst();
		if (!user || (identifier !== user.email && identifier !== user.phone)) {
			return reply
				.code(400)
				.send({ error: "That doesn't match the details on your account." });
		}
		if (identifier === user.email) {
			const code = await issueCode(
				db,
				identifier,
				"verify",
				"otp",
				LINK_TTL_MS,
			);
			await fastify.mailer.send({
				to: identifier,
				subject: "Your twodb verification code",
				text: `Your twodb verification code: ${code}. It works once, for 15 minutes.`,
			});
		} else {
			const code = await issueCode(db, identifier, "verify", "otp", OTP_TTL_MS);
			await fastify.texter.send({
				to: identifier,
				text: `Your twodb verification code: ${code}. It works once, for 10 minutes.`,
			});
		}
		return { ok: true };
	});
}
