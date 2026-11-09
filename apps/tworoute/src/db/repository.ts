import type { Kysely } from "kysely";
import { ulid } from "ulid";
import type { TwoRouteDb } from "./schema.js";

export interface CreateConnectionInput {
  workspaceId: string;
  spaceId: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
}

export function createConnectionsRepo(db: Kysely<TwoRouteDb>) {
  return {
    async create(input: CreateConnectionInput) {
      const row = {
        id: ulid(),
        workspace_id: input.workspaceId,
        space_id: input.spaceId,
        name: input.name,
        provider: input.provider,
        base_url: input.baseUrl,
        api_key: input.apiKey,
        default_model: input.defaultModel ?? null,
        created_at: new Date().toISOString(),
      };
      await db.insertInto("llm_connection").values(row as any).execute();
      return row;
    },

    async listForSpaces(spaceIds: string[]) {
      if (spaceIds.length === 0) return [];
      return db.selectFrom("llm_connection").selectAll().where("space_id", "in", spaceIds).execute();
    },

    async get(id: string) {
      return db.selectFrom("llm_connection").selectAll().where("id", "=", id).executeTakeFirst();
    },
  };
}

export type ConnectionsRepo = ReturnType<typeof createConnectionsRepo>;
