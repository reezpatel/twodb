import type { TwodbFastifyInstance } from "@twodb/contracts";
import {
	rootServicePlugin,
	runPluginMigrations,
	typedDb,
} from "@twodb/shared-backend";
import { meetingsDb } from "./db";
import { buildMigrations } from "./db/migrations";
import type { MeetingsCtx } from "./lib/ctx";
import { registerRoutes } from "./routes";
import { PLUGIN_ID } from "../shared/constants";
import { meetingsManifest } from "../shared/manifest";

export const TwodbMeetingsServiceManifest = {
	...meetingsManifest,

	permissions: [
		{
			permission: "plugin.twodb.meetings:meeting.read",
			description: "Read meetings, recordings, transcripts and summaries",
		},
		{
			permission: "plugin.twodb.meetings:meeting.write",
			description: "Create meetings, record, append transcript segments",
		},
		{
			permission: "plugin.twodb.meetings:meeting.manage",
			description: "Start/end/cancel meetings, delete recordings",
		},
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.meetings:meeting.read",
			"plugin.twodb.meetings:meeting.write",
			"plugin.twodb.meetings:meeting.manage",
		],
		member: [
			"plugin.twodb.meetings:meeting.read",
			"plugin.twodb.meetings:meeting.write",
		],
	},

	plugin: rootServicePlugin("twodb-meetings-service", async (fastify) => {
		await runPluginMigrations(typedDb(fastify), PLUGIN_ID, buildMigrations());
		const ctx: MeetingsCtx = { db: meetingsDb(fastify) };
		return (scope: TwodbFastifyInstance) => registerRoutes(scope, ctx);
	}),
};

export const service = TwodbMeetingsServiceManifest;

export default TwodbMeetingsServiceManifest;
