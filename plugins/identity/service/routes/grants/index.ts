import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerDeleteGrant } from "./delete-grant";
import { registerGetGrants } from "./get-grants";
import { registerPostGrants } from "./post-grants";

export function registerGrantRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	registerPostGrants(fastify, ctx);
	registerDeleteGrant(fastify, ctx);
	registerGetGrants(fastify, ctx);
}
