import { identityDb } from "./db";
import "@fastify/cookie";
import type { TwodbFastifyInstance } from "@twodb/contracts";
import { runPluginMigrations, typedDb } from "@twodb/shared-backend";
import { outboxPlugin } from "./lib/outbox/outbox";
import { seedDeploymentMethods } from "./lib/users/methods";
import { requireSuperadmin as makeRequireSuperadmin } from "./lib/admin/admin";
import type { AuthCtx } from "./lib/auth/ctx";
import { maybeSeedSuperadmin } from "./lib/auth/superadmin";
export { identityAuthPlugin } from "./lib/auth/auth-plugin";
import { registerRoutes } from "./routes";
import { buildMigrations } from "./db/migrations";
import type { IdentifierMode } from "./db/schema";
import { PLUGIN_ID } from "../shared/constants";
import { identityManifest } from "../shared/manifest";
import { decorateAuthz } from "./lib/auth/require-claim";
import { buildIdentityClaimCatalog } from "./lib/auth/claims-catalog";

export const TwodbIdentityServiceManifest = {
	...identityManifest,

	permissions: [
		{
			permission: "plugin.twodb.identity:org.manage",
			description: "Manage organizations",
		},
		{
			permission: "plugin.twodb.identity:workspace.create",
			description: "Create workspaces",
		},
		{
			permission: "plugin.twodb.identity:workspace.manage",
			description: "Manage workspaces",
		},
		{
			permission: "plugin.twodb.identity:member.invite",
			description: "Invite members",
		},
		{
			permission: "plugin.twodb.identity:member.remove",
			description: "Remove members",
		},
		{
			permission: "plugin.twodb.identity:role.manage",
			description: "Manage roles",
		},
		{
			permission: "plugin.twodb.identity:app.manage",
			description: "Manage apps",
		},
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.identity:workspace.manage",
			"plugin.twodb.identity:member.invite",
			"plugin.twodb.identity:member.remove",
			"plugin.twodb.identity:role.manage",
		],
	},

	plugin: async (fastify: TwodbFastifyInstance) => {
		const config = (
			fastify as unknown as {
				config: {
					TWODB_IDENTIFIER: IdentifierMode;
					TWODB_SUPERADMIN_EMAIL: string;
					TWODB_REQUIRE_VERIFIED: boolean;
					TWODB_API_ORIGIN: string;
				};
			}
		).config;
		const mode = config.TWODB_IDENTIFIER;
		if (!["email", "phone", "email+phone"].includes(mode)) {
			throw new Error(
				`twodb.identity: TWODB_IDENTIFIER must be email | phone | email+phone, got "${mode}"`,
			);
		}

		const db = identityDb(fastify);
		await fastify.register(outboxPlugin);
		await runPluginMigrations(typedDb(fastify), PLUGIN_ID, buildMigrations());
		await seedDeploymentMethods(db);

		const ctx: AuthCtx = {
			db,
			mode,
			requireVerified: config.TWODB_REQUIRE_VERIFIED,
			apiOrigin: config.TWODB_API_ORIGIN,
			superadminEmail: config.TWODB_SUPERADMIN_EMAIL,
		};
		fastify.decorate("requireSuperadmin", makeRequireSuperadmin(fastify));
		decorateAuthz(
			fastify,
			buildIdentityClaimCatalog(TwodbIdentityServiceManifest.permissions),
		);
		registerRoutes(fastify, ctx);

		await maybeSeedSuperadmin(db, fastify, config.TWODB_SUPERADMIN_EMAIL);
	},
};

export const service = TwodbIdentityServiceManifest;

export default TwodbIdentityServiceManifest;
