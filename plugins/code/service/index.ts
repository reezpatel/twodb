import websocket from "@fastify/websocket";
import type { TwodbFastifyInstance } from "@twodb/contracts";
import {
	rootServicePlugin,
	runPluginMigrations,
	typedDb,
} from "@twodb/shared-backend";
import { codeDb } from "./db";
import { buildMigrations } from "./db/migrations";
import type { CodeCtx } from "./lib/ctx";
import { registerRoutes } from "./routes";
import { PLUGIN_ID } from "../shared/constants";
import { codeManifest } from "../shared/manifest";

export const TwodbCodeServiceManifest = {
	...codeManifest,

	permissions: [
		{
			permission: "plugin.twodb.code:sessions.read",
			description: "List and view sessions and their messages",
		},
		{
			permission: "plugin.twodb.code:sessions.manage",
			description: "Create sessions, prompt and stop them",
		},
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.code:sessions.read",
			"plugin.twodb.code:sessions.manage",
		],
		member: ["plugin.twodb.code:sessions.read"],
	},

	plugin: rootServicePlugin("twodb-code-service", async (fastify) => {
		await runPluginMigrations(typedDb(fastify), PLUGIN_ID, buildMigrations());
		// Not fp-wrapped, so registering twice throws — guard on boot order
		// (the node plugin normally registers it first, with bigger payloads).
		if (!fastify.hasPlugin("@fastify/websocket")) {
			await fastify.register(websocket);
		}
		const ctx: CodeCtx = { db: codeDb(fastify) };
		return (scope: TwodbFastifyInstance) => registerRoutes(scope, ctx);
	}),
};

export const service = TwodbCodeServiceManifest;

export default TwodbCodeServiceManifest;
