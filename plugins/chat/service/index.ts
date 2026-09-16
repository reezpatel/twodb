import type { TwodbFastifyInstance } from "@twodb/contracts";
import {
	rootServicePlugin,
	runPluginMigrations,
	typedDb,
} from "@twodb/shared-backend";
import { chatDb } from "./db";
import { buildMigrations } from "./db/migrations";
import type { ChatCtx } from "./lib/ctx";
import { registerRoutes } from "./routes";
import { PLUGIN_ID } from "../shared/constants";
import { chatManifest } from "../shared/manifest";

export const TwodbChatServiceManifest = {
	...chatManifest,
	permissions: [
		{
			permission: "plugin.io.twodb.chat:chat.read",
			description: "Read conversations and messages",
		},
		{
			permission: "plugin.io.twodb.chat:chat.write",
			description:
				"Create conversations, messages, reactions, and read receipts",
		},
		{
			permission: "plugin.io.twodb.chat:chat.manage",
			description: "Manage conversation members and channels",
		},
	],
	roleDefaults: {
		manager: [
			"plugin.io.twodb.chat:chat.read",
			"plugin.io.twodb.chat:chat.write",
			"plugin.io.twodb.chat:chat.manage",
		],
		member: [
			"plugin.io.twodb.chat:chat.read",
			"plugin.io.twodb.chat:chat.write",
		],
	},
	plugin: rootServicePlugin("twodb-chat-service", async (fastify) => {
		await runPluginMigrations(typedDb(fastify), PLUGIN_ID, buildMigrations());
		const ctx: ChatCtx = { db: chatDb(fastify) };
		return (scope: TwodbFastifyInstance) => registerRoutes(scope, ctx);
	}),
};

export const service = TwodbChatServiceManifest;
export default TwodbChatServiceManifest;
