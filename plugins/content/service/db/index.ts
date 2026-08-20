import { pluginSchemaName, scopedDb } from "@twodb/shared-backend";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { PLUGIN_ID } from "../../shared/constants";
import type { ContentDB } from "./schema";

export const CONTENT_SCHEMA = pluginSchemaName(PLUGIN_ID);

/** db handle scoped to the plugin's postgres schema (`io_twodb_content`). */
export function contentDb(fastify: FastifyInstance): Kysely<ContentDB> {
	return scopedDb<ContentDB>(fastify, PLUGIN_ID);
}
