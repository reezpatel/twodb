import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { PUBLIC } from "../../../shared/constants";
import { loadProvider, STATE_COOKIE } from "./sso-shared";

export function registerGetAuthSsoProvider(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	const redirectUri = (provider: string) =>
		`${ctx.apiOrigin}/api/v1/twodb.identity/auth/sso/${provider}/callback`;

	fastify.get("/auth/sso/:provider", PUBLIC, async (request, reply) => {
		const { provider } = request.params as { provider: string };
		const found = await loadProvider(provider, ctx);
		if (!found)
			return reply.code(404).send({ error: "Unknown sign-in provider." });
		const state = randomBytes(16).toString("base64url");
		reply.setCookie(STATE_COOKIE, state, {
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			maxAge: 10 * 60,
		});
		let url: URL;
		try {
			url = new URL(found.endpoints.authorizationEndpoint);
		} catch {
			return reply.code(404).send({ error: "Unknown sign-in provider." });
		}
		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_id", found.config.clientId!);
		url.searchParams.set("redirect_uri", redirectUri(provider));
		url.searchParams.set("scope", "openid email profile phone");
		url.searchParams.set("state", state);
		return reply.redirect(url.toString());
	});
}
