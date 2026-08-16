import type { FastifyInstance } from "fastify";
import type { AuthCtx } from "../../lib/auth/ctx";
import { registerDeleteAdminSuperadmin } from "./delete-admin-superadmin";
import { registerGetAdminOrgs } from "./get-admin-orgs";
import { registerGetAdminOverview } from "./get-admin-overview";
import { registerGetAdminSuperadmins } from "./get-admin-superadmins";
import { registerPostAdminOrgsSuspend } from "./post-admin-orgs-suspend";
import { registerPostAdminSuperadmins } from "./post-admin-superadmins";
import { registerPutAdminAccessPolicy } from "./put-admin-access-policy";

export function registerAdminRoutes(
	fastify: FastifyInstance,
	ctx: AuthCtx,
): void {
	registerPutAdminAccessPolicy(fastify, ctx);
	registerGetAdminOrgs(fastify, ctx);
	registerPostAdminOrgsSuspend(fastify, ctx);
	registerGetAdminOverview(fastify, ctx);
	registerGetAdminSuperadmins(fastify, ctx);
	registerPostAdminSuperadmins(fastify, ctx);
	registerDeleteAdminSuperadmin(fastify, ctx);
}
