import type { TwodbFastifyInstance } from "@twodb/contracts";
import {
	rootServicePlugin,
	runPluginMigrations,
	typedDb,
} from "@twodb/shared-backend";
import { calendarDb } from "./db";
import { buildMigrations } from "./db/migrations";
import type { CalendarCtx } from "./lib/ctx";
import { registerRoutes } from "./routes";
import { PLUGIN_ID } from "../shared/constants";
import { calendarManifest } from "../shared/manifest";

export const TwodbCalendarServiceManifest = {
	...calendarManifest,

	permissions: [
		{
			permission: "plugin.twodb.calendar:calendar.read",
			description: "Read calendars and events",
		},
		{
			permission: "plugin.twodb.calendar:calendar.write",
			description: "Create and edit events, answer invitations",
		},
		{
			permission: "plugin.twodb.calendar:calendar.manage",
			description: "Connect accounts, manage calendars, sync",
		},
	],
	roleDefaults: {
		manager: [
			"plugin.twodb.calendar:calendar.read",
			"plugin.twodb.calendar:calendar.write",
			"plugin.twodb.calendar:calendar.manage",
		],
		member: [
			"plugin.twodb.calendar:calendar.read",
			"plugin.twodb.calendar:calendar.write",
		],
	},

	plugin: rootServicePlugin("twodb-calendar-service", async (fastify) => {
		await runPluginMigrations(typedDb(fastify), PLUGIN_ID, buildMigrations());
		const ctx: CalendarCtx = {
			db: calendarDb(fastify),
			credentialsKey: process.env.TWODB_CALENDAR_ENCRYPTION_KEY ?? null,
		};
		return (scope: TwodbFastifyInstance) => registerRoutes(scope, ctx);
	}),
};

export const service = TwodbCalendarServiceManifest;

export default TwodbCalendarServiceManifest;
