import { pluginSchemaName, scopedDb } from "@twodb/shared-backend";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { PLUGIN_ID } from "../../shared/constants";
import type { IdentityDB } from "./schema";

export const IDENTITY_SCHEMA = pluginSchemaName(PLUGIN_ID);

/** db handle scoped to the plugin's postgres schema (`io_twodb_identity`). */
export function identityDb(fastify: FastifyInstance): Kysely<IdentityDB> {
	return scopedDb<IdentityDB>(fastify, PLUGIN_ID);
}
