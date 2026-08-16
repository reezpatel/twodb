import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerDeleteAppAssignment } from "./delete-app-assignment";
import { registerGetAppRoles } from "./get-app-roles";
import { registerPostAppAssignments } from "./post-app-assignments";
import { registerPostAppRoles } from "./post-app-roles";
import { registerPostApps } from "./post-apps";

export function registerAppRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	registerPostApps(fastify, ctx);
	registerGetAppRoles(fastify, ctx);
	registerPostAppRoles(fastify, ctx);
	registerPostAppAssignments(fastify, ctx);
	registerDeleteAppAssignment(fastify, ctx);

	// Mark requireAppClaim as used (registered above for future dogfood routes).
	void fastify.identityRequireAppClaim;
}
