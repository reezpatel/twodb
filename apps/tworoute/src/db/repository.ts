import type { Kysely } from "kysely";
import { ulid } from "ulid";
import type { TwoRouteDb, LlmConnectionRow } from "./schema.js";
import { encryptSecret, decryptSecret } from "../crypto.js";

export interface CreateConnectionInput {
  workspaceId: string;
  spaceId: string;
  name: string;
  provider: string;
  baseUrl: string;
  /** Plaintext API key — encrypted before it ever touches the DB. */
  apiKey: string;
  defaultModel?: string;
}

export function createConnectionsRepo(db: Kysely<TwoRouteDb>, encryptionKey: string) {
  function decryptRow(row: LlmConnectionRow): LlmConnectionRow {
    return { ...row, api_key: decryptSecret(row.api_key, encryptionKey) };
  }

  return {
    async create(input: CreateConnectionInput) {
      const row = {
        id: ulid(),
        workspace_id: input.workspaceId,
        space_id: input.spaceId,
        name: input.name,
        provider: input.provider,
        base_url: input.baseUrl,
        api_key: encryptSecret(input.apiKey, encryptionKey),
        default_model: input.defaultModel ?? null,
        created_at: new Date().toISOString(),
      };
      await db.insertInto("llm_connection").values(row as any).execute();
      return row;
    },

    /** Name is unique per workspace (DB-enforced) — the CLI/tests address connections by it. */
    async getByName(workspaceId: string, name: string) {
      const row = await db
        .selectFrom("llm_connection")
        .selectAll()
        .where("workspace_id", "=", workspaceId)
        .where("name", "=", name)
        .executeTakeFirst();
      return row ? decryptRow(row) : undefined;
    },

    async get(id: string) {
      const row = await db.selectFrom("llm_connection").selectAll().where("id", "=", id).executeTakeFirst();
      return row ? decryptRow(row) : undefined;
    },

    async listForSpaces(spaceIds: string[]) {
      if (spaceIds.length === 0) return [];
      // Listings never include the key at all — not even encrypted.
      return db
        .selectFrom("llm_connection")
        .select(["id", "workspace_id", "space_id", "name", "provider", "base_url", "default_model", "created_at"])
        .where("space_id", "in", spaceIds)
        .execute();
    },

    /** Workspace-wide listing — used when the caller has no space filter (workspace API keys always see every space). */
    async listForWorkspace(workspaceId: string) {
      return db
        .selectFrom("llm_connection")
        .select(["id", "workspace_id", "space_id", "name", "provider", "base_url", "default_model", "created_at"])
        .where("workspace_id", "=", workspaceId)
        .execute();
    },

    async update(
      id: string,
      patch: { name?: string; baseUrl?: string; defaultModel?: string | null; apiKey?: string },
    ) {
      const set: Record<string, string | null> = {};
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.baseUrl !== undefined) set.base_url = patch.baseUrl;
      if (patch.defaultModel !== undefined) set.default_model = patch.defaultModel;
      if (patch.apiKey !== undefined) set.api_key = encryptSecret(patch.apiKey, encryptionKey);
      if (Object.keys(set).length === 0) return;
      await db.updateTable("llm_connection").set(set).where("id", "=", id).execute();
    },

    async remove(id: string) {
      await db.deleteFrom("llm_connection").where("id", "=", id).execute();
    },

    async logUsage(entry: {
      connectionId: string;
      workspaceId: string;
      model: string;
      status: "ok" | "error";
      inputTokens?: number | null;
      outputTokens?: number | null;
      latencyMs: number;
    }) {
      await db
        .insertInto("usage_log")
        .values({
          id: ulid(),
          connection_id: entry.connectionId,
          workspace_id: entry.workspaceId,
          model: entry.model,
          status: entry.status,
          input_tokens: entry.inputTokens ?? null,
          output_tokens: entry.outputTokens ?? null,
          latency_ms: entry.latencyMs,
          created_at: new Date().toISOString(),
        } as any)
        .execute();
    },

    async usageSummary(workspaceId: string, sinceIso: string) {
      const rows = await db
        .selectFrom("usage_log")
        .select([
          "connection_id",
          "model",
          (eb) => eb.fn.countAll().as("calls"),
          (eb) => eb.fn.sum("input_tokens").as("input_tokens"),
          (eb) => eb.fn.sum("output_tokens").as("output_tokens"),
        ])
        .where("workspace_id", "=", workspaceId)
        .where("created_at", ">=", sinceIso)
        .where("status", "=", "ok")
        .groupBy(["connection_id", "model"])
        .execute();
      return rows;
    },
  };
}

export type ConnectionsRepo = ReturnType<typeof createConnectionsRepo>;
