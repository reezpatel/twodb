import { scopedDb, pluginSchemaName } from "@twodb/shared-backend";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { PLUGIN_ID } from "../../shared/constants";
import type { ChatDB } from "./schema";

export const CHAT_SCHEMA = pluginSchemaName(PLUGIN_ID);

export function chatDb(fastify: FastifyInstance): Kysely<ChatDB> {
	return scopedDb<ChatDB>(fastify, PLUGIN_ID);
}
