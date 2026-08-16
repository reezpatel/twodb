import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerGetMeMemberships } from "./get-me-memberships";

export function registerMeRoutes(fastify: FastifyInstance, ctx: AuthCtx): void {
	registerGetMeMemberships(fastify, ctx);
}
