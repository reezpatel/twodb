import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerGetWorkspaceRoles } from "./get-workspace-roles";
import { registerPostWorkspaceRoles } from "./post-workspace-roles";

export function registerRoleRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	registerGetWorkspaceRoles(fastify, ctx);
	registerPostWorkspaceRoles(fastify, ctx);
}
