import type { FastifyInstance } from "fastify";
import type { Principal } from "../../lib/types";
import type { AuthCtx } from "../../lib/auth/ctx";
import { getDeploymentMethod, upsertUserMethod } from "../../lib/users/methods";
import { hashPassword } from "../../lib/auth/passwords";

export function registerPostMeAuthMethods(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const { db } = ctx;

	fastify.post("/me/auth-methods", async (request, reply) => {
		const { userId } = request.principal as Principal;
		const body = request.body as { method?: string; password?: string };
		if (body.method === "password") {
			if (!body.password || body.password.length < 8) {
				return reply
					.code(400)
					.send({ error: "Password needs at least 8 characters." });
			}
			const offered = await getDeploymentMethod(db, "password");
			if (!offered?.enabled) {
				return reply.code(403).send({
					error: "Password sign-in is turned off on this server.",
				});
			}
			await upsertUserMethod(db, userId, "password", {
				hash: await hashPassword(body.password),
			});
			fastify.bus.emit("twodb.identity.authmethod.configured", {
				method: "password",
			});
			return reply.code(201).send({ ok: true });
		}
		if (body.method?.startsWith("sso.")) {
			const offered = await getDeploymentMethod(db, body.method);
			if (!offered?.enabled) {
				return reply.code(404).send({ error: "Unknown sign-in provider." });
			}
			// Linking happens through the normal SSO flow: the provider's
			// verified identifier lands on this same user row.
			return {
				url: `${ctx.apiOrigin}/api/v1/twodb.identity/auth/sso/${body.method.slice(4)}`,
			};
		}
		return reply.code(400).send({ error: "Unknown sign-in method." });
	});
}
