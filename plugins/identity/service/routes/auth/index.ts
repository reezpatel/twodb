import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerGetAuthSession } from "./get-auth-session";
import { registerGetAuthLinkToken } from "./get-auth-link-token";
import { registerGetAuthSsoProvider } from "./get-auth-sso-provider";
import { registerGetAuthSsoProviderCallback } from "./get-auth-sso-provider-callback";
import { registerPostAuthLink } from "./post-auth-link";
import { registerPostAuthLogin } from "./post-auth-login";
import { registerPostAuthLogout } from "./post-auth-logout";
import { registerPostAuthOtp } from "./post-auth-otp";
import { registerPostAuthOtpConfirm } from "./post-auth-otp-confirm";
import { registerPostAuthRegister } from "./post-auth-register";
import { registerPostAuthVerify } from "./post-auth-verify";
import { registerPostAuthVerifyConfirm } from "./post-auth-verify-confirm";

export function registerAuthRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	registerPostAuthRegister(fastify, ctx);
	registerPostAuthLogin(fastify, ctx);
	registerPostAuthLogout(fastify, ctx);
	registerGetAuthSession(fastify);
	registerPostAuthLink(fastify, ctx);
	registerGetAuthLinkToken(fastify, ctx);
	registerPostAuthOtp(fastify, ctx);
	registerPostAuthOtpConfirm(fastify, ctx);
	registerPostAuthVerify(fastify, ctx);
	registerPostAuthVerifyConfirm(fastify, ctx);
	registerGetAuthSsoProvider(fastify, ctx);
	registerGetAuthSsoProviderCallback(fastify, ctx);
}
