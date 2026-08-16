import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerPostOrgs } from "./post-orgs";

export function registerOrgRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	registerPostOrgs(fastify, ctx);
}
