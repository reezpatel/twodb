import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerPostWorkspaceMembers } from "./post-workspace-members";

export function registerMemberRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	registerPostWorkspaceMembers(fastify, ctx);
}
