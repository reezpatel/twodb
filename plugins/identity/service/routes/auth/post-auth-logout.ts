import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { destroySession } from "../../lib/auth/sessions";
import { SESSION_COOKIE, VERIFY_EXEMPT } from "../../../shared/constants";

export function registerPostAuthLogout(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;

	fastify.post("/auth/logout", VERIFY_EXEMPT, async (request, reply) => {
		const token = request.cookies[SESSION_COOKIE];
		if (token) await destroySession(db, token);
		reply.clearCookie(SESSION_COOKIE, { path: "/" });
		return { ok: true };
	});
}
