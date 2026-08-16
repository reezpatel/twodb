import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { consumeToken } from "../../lib/auth/codes";
import {
	canCompleteChallenge,
	findUserByLoginIdentifier,
	getUserMethod,
	upsertUserMethod,
} from "../../lib/users/methods";
import { startSession } from "../../lib/auth/signin";
import { PUBLIC } from "../../../shared/constants";

export function registerGetAuthLinkToken(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	if (ctx.mode === "phone") return;
	const { db, mode } = ctx;

	fastify.get("/auth/link/:token", PUBLIC, async (request, reply) => {
		const { token } = request.params as { token: string };
		const email = await consumeToken(db, "login", token);
		const user = email
			? await findUserByLoginIdentifier(db, mode, email)
			: undefined;
		if (!email || !user) {
			return reply
				.code(401)
				.send({ error: "That link has expired. Ask for a fresh one." });
		}
		const verdict = await canCompleteChallenge(db, user, "email_link", {
			mode,
		});
		if (!verdict.ok) {
			return reply
				.code(401)
				.send({ error: "That link has expired. Ask for a fresh one." });
		}
		// First-use: persist the method so subsequent sign-ins succeed.
		const own = await getUserMethod(db, user.id, "email_link");
		if (!own) {
			await upsertUserMethod(db, user.id, "email_link", {});
		}
		// Holding the link proves the inbox — stamp verification.
		if (user.email === email && user.email_verified_at === null) {
			await db
				.updateTable("users")
				.set({ email_verified_at: new Date() })
				.where("id", "=", user.id)
				.execute();
		}
		await startSession(fastify, reply, db, user.id, "email_link");
		return reply.redirect("/");
	});
}
