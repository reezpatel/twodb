import { pluginSchemaName, scopedDb } from "@twodb/shared-backend";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { PLUGIN_ID } from "../../shared/constants";
import type { CalendarDB } from "./schema";

export const CALENDAR_SCHEMA = pluginSchemaName(PLUGIN_ID);

/** db handle scoped to the plugin's postgres schema (`io_twodb_calendar`). */
export function calendarDb(fastify: FastifyInstance): Kysely<CalendarDB> {
	return scopedDb<CalendarDB>(fastify, PLUGIN_ID);
}
