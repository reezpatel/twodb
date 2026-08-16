import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerDeleteWorkspaceAssignment } from "./delete-workspace-assignment";
import { registerPostWorkspaceAssignments } from "./post-workspace-assignments";

export function registerAssignmentRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	registerPostWorkspaceAssignments(fastify, ctx);
	registerDeleteWorkspaceAssignment(fastify, ctx);
}
