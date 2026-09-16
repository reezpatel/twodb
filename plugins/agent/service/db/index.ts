import { pluginSchemaName, scopedDb } from "@twodb/shared-backend";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { PLUGIN_ID } from "../../shared/constants";
import type { AgentDB } from "./schema";

export const AGENT_SCHEMA = pluginSchemaName(PLUGIN_ID);

/** db handle scoped to the plugin's postgres schema (`io_twodb_agent`). */
export function agentDb(fastify: FastifyInstance): Kysely<AgentDB> {
	return scopedDb<AgentDB>(fastify, PLUGIN_ID);
}
