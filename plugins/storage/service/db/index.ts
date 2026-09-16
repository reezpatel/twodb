import { pluginSchemaName, scopedDb } from "@twodb/shared-backend";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { PLUGIN_ID } from "../../shared/constants";
import type { StorageDB } from "./schema";

export const STORAGE_SCHEMA = pluginSchemaName(PLUGIN_ID);

/** db handle scoped to the plugin's postgres schema (`io_twodb_storage`). */
export function storageDb(fastify: FastifyInstance): Kysely<StorageDB> {
	return scopedDb<StorageDB>(fastify, PLUGIN_ID);
}
