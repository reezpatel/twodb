import { pluginSchemaName, scopedDb } from "@twodb/shared-backend";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { PLUGIN_ID } from "../../shared/constants";
import type { MeetingsDB } from "./schema";

export const MEETINGS_SCHEMA = pluginSchemaName(PLUGIN_ID);

/** db handle scoped to the plugin's postgres schema (`io_twodb_meetings`). */
export function meetingsDb(fastify: FastifyInstance): Kysely<MeetingsDB> {
	return scopedDb<MeetingsDB>(fastify, PLUGIN_ID);
}
