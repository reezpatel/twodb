import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerGetAdminAuthMethods } from "./get-admin-auth-methods";
import { registerGetAuthMethods } from "./get-auth-methods";
import { registerGetMeAuthMethods } from "./get-me-auth-methods";
import { registerPatchMeAuthMethod } from "./patch-me-auth-method";
import { registerPostMeAuthMethods } from "./post-me-auth-methods";
import { registerPutAdminAuthMethods } from "./put-admin-auth-methods";

export function registerMethodRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	registerGetAuthMethods(fastify, ctx);
	registerGetMeAuthMethods(fastify, ctx);
	registerPostMeAuthMethods(fastify, ctx);
	registerPatchMeAuthMethod(fastify, ctx);
	registerGetAdminAuthMethods(fastify, ctx);
	registerPutAdminAuthMethods(fastify, ctx);
}
