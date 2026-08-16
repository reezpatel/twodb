import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerGetWorkspaceMembers } from "./get-workspace-members";
import { registerPostWorkspaces } from "./post-workspaces";

export function registerWorkspaceRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	registerPostWorkspaces(fastify, ctx);
	registerGetWorkspaceMembers(fastify, ctx);
}
