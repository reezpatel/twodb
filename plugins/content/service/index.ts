import type { TwodbFastifyInstance } from "@twodb/contracts";
import { runPluginMigrations, typedDb } from "@twodb/shared-backend";
import { contentDb } from "./db";
import { buildMigrations } from "./db/migrations";
import type { ContentCtx } from "./lib/ctx";
import { registerRoutes } from "./routes";
import { PLUGIN_ID } from "../shared/constants";
import { contentManifest } from "../shared/manifest";

export const TwodbContentServiceManifest = {
	...contentManifest,

	permissions: [
		{
			permission: "plugin.twodb.content:content.read",
			description: "Read content (tree, rows, views)",
		},
		{
			permission: "plugin.twodb.content:content.write",
			description: "Edit rows, columns and views",
		},
		{
			permission: "plugin.twodb.content:content.manage",
			description: "Create, move and delete sections and folders",
		},
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.content:content.read",
			"plugin.twodb.content:content.write",
			"plugin.twodb.content:content.manage",
		],
		member: [
			"plugin.twodb.content:content.read",
			"plugin.twodb.content:content.write",
		],
	},

	plugin: async (fastify: TwodbFastifyInstance) => {
		await runPluginMigrations(typedDb(fastify), PLUGIN_ID, buildMigrations());
		const ctx: ContentCtx = { db: contentDb(fastify) };
		registerRoutes(fastify, ctx);
	},
};

export const service = TwodbContentServiceManifest;

export default TwodbContentServiceManifest;
