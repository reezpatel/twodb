import type { TwodbFastifyInstance } from "@twodb/contracts";
import type { AuthCtx } from "../lib/auth/ctx";
import { registerAuthRoutes } from "./auth";
import { registerMethodRoutes } from "./methods";
import { registerMeRoutes } from "./me";
import { registerOrgRoutes } from "./orgs";
import { registerWorkspaceRoutes } from "./workspaces";
import { registerRoleRoutes } from "./roles";
import { registerAssignmentRoutes } from "./assignments";
import { registerGrantRoutes } from "./grants";
import { registerMemberRoutes } from "./members";
import { registerAppRoutes } from "./apps";
import { registerAdminRoutes } from "./admin";

export function registerRoutes(
	fastify: TwodbFastifyInstance,
	ctx: AuthCtx,
): void {
	registerAuthRoutes(fastify, ctx);
	registerMethodRoutes(fastify, ctx);
	registerMeRoutes(fastify, ctx);
	registerOrgRoutes(fastify, ctx);
	registerWorkspaceRoutes(fastify, ctx);
	registerRoleRoutes(fastify, ctx);
	registerAssignmentRoutes(fastify, ctx);
	registerGrantRoutes(fastify, ctx);
	registerMemberRoutes(fastify, ctx);
	registerAppRoutes(fastify, ctx);
	registerAdminRoutes(fastify, ctx);
}
