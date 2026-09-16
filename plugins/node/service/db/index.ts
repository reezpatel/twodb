import { pluginSchemaName, scopedDb } from "@twodb/shared-backend";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { PLUGIN_ID } from "../../shared/constants";
import type { NodeDB } from "./schema";

export const NODE_SCHEMA = pluginSchemaName(PLUGIN_ID);

/** db handle scoped to the plugin's postgres schema (`io_twodb_node`). */
export function nodeDb(fastify: FastifyInstance): Kysely<NodeDB> {
	return scopedDb<NodeDB>(fastify, PLUGIN_ID);
}
