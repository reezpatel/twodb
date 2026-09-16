import { pluginSchemaName, scopedDb } from "@twodb/shared-backend";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { PLUGIN_ID } from "../../shared/constants";
import type { CodeDB } from "./schema";

export const CODE_SCHEMA = pluginSchemaName(PLUGIN_ID);

/** db handle scoped to the plugin's postgres schema (`io_twodb_code`). */
export function codeDb(fastify: FastifyInstance): Kysely<CodeDB> {
	return scopedDb<CodeDB>(fastify, PLUGIN_ID);
}
