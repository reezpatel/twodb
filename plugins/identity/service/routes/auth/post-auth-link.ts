import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { issueCode } from "../../lib/auth/codes";
import {
	canOfferChallenge,
	findUserByLoginIdentifier,
	getUserMethod,
} from "../../lib/users/methods";
import { LINK_TTL_MS, PUBLIC } from "../../../shared/constants";

export function registerPostAuthLink(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	if (ctx.mode === "phone") return;
	const { db, mode } = ctx;

	fastify.post("/auth/link", PUBLIC, async (request, _reply) => {
		const body = request.body as { email?: string };
		const email = body.email?.trim().toLowerCase();
		// Always 200 — never leak whether an address has an account.
		if (!email) return { ok: true };
		const user = await findUserByLoginIdentifier(db, mode, email);
		// Deployment + mode gate only. The link itself is the proof of
		// possession; the user-level switch is decided on the callback.
		const offer = await canOfferChallenge(db, "email_link", { mode });
		if (!offer.ok) return { ok: true };
		if (user) {
			const own = await getUserMethod(db, user.id, "email_link");
			// Refuse to re-enable a method the user explicitly disabled.
			if (own && !own.enabled) return { ok: true };
		}
		const token = await issueCode(db, email, "login", "token", LINK_TTL_MS);
		await fastify.mailer.send({
			to: email,
			subject: "Your twodb sign-in link",
			text: `Sign in to twodb: ${ctx.apiOrigin}/api/v1/twodb.identity/auth/link/${token}\n\nThis link works once, for 15 minutes.`,
		});
		return { ok: true };
	});
}
