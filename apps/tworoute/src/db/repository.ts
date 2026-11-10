import type { Kysely } from "kysely";
import { sql } from "kysely";
import { ulid } from "ulid";
import type { TwoRouteDb, LlmConnectionRow, QuotaRow } from "./schema.js";
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
  /** Extra provider fields (org, accountId, OAuth tokens…) — encrypted as one blob. */
  config?: Record<string, string>;
}

export interface ConnectionConfig {
  [key: string]: string | undefined;
}

export function createConnectionsRepo(db: Kysely<TwoRouteDb>, encryptionKey: string) {
  function decryptRow(row: LlmConnectionRow): LlmConnectionRow {
    const config = row.config ? (JSON.parse(decryptSecret(row.config, encryptionKey)) as ConnectionConfig) : {};
    return { ...row, api_key: decryptSecret(row.api_key, encryptionKey), config: JSON.stringify(config) };
  }

  /** Decrypted connection + parsed config, for provider adapters. */
  function toLive(row: LlmConnectionRow): LlmConnectionRow & { configParsed: ConnectionConfig } {
    const decrypted = decryptRow(row);
    return { ...decrypted, configParsed: JSON.parse(decrypted.config ?? "{}") as ConnectionConfig };
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
        api_key: encryptSecret(input.apiKey || "-", encryptionKey),
        default_model: input.defaultModel ?? null,
        config: input.config && Object.keys(input.config).length ? encryptSecret(JSON.stringify(input.config), encryptionKey) : null,
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

    /** Live connection with decrypted config — for provider adapters/quota collectors only. */
    async getLive(id: string) {
      const row = await db.selectFrom("llm_connection").selectAll().where("id", "=", id).executeTakeFirst();
      return row ? toLive(row) : undefined;
    },

    async listForSpaces(spaceIds: string[]) {
      if (spaceIds.length === 0) return [];
      // Listings never include the key or config at all — not even encrypted.
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
      patch: {
        name?: string;
        spaceId?: string;
        baseUrl?: string;
        defaultModel?: string | null;
        apiKey?: string;
        config?: Record<string, string>;
      },
    ) {
      const set: Record<string, string | null> = {};
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.spaceId !== undefined) set.space_id = patch.spaceId;
      if (patch.baseUrl !== undefined) set.base_url = patch.baseUrl;
      if (patch.defaultModel !== undefined) set.default_model = patch.defaultModel;
      if (patch.apiKey !== undefined) set.api_key = encryptSecret(patch.apiKey, encryptionKey);
      if (patch.config !== undefined) {
        set.config = Object.keys(patch.config).length ? encryptSecret(JSON.stringify(patch.config), encryptionKey) : null;
      }
      if (Object.keys(set).length === 0) return;
      await db.updateTable("llm_connection").set(set).where("id", "=", id).execute();
    },

    async remove(id: string) {
      await db.deleteFrom("llm_connection").where("id", "=", id).execute();
      // Cached models and quota snapshots die with the connection (usage
      // history stays — audit/billing).
      await db.deleteFrom("llm_model").where("connection_id", "=", id).execute();
      await db.deleteFrom("llm_quota").where("connection_id", "=", id).execute();
    },

    async logUsage(entry: {
      connectionId: string;
      workspaceId: string;
      model: string;
      status: "ok" | "error";
      inputTokens?: number | null;
      outputTokens?: number | null;
      latencyMs: number;
      /** When set, this row records a tool invocation, not a completion. */
      toolName?: string | null;
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
          tool_name: entry.toolName ?? null,
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

    /** Per-connection totals for the usage endpoint (parity with legacy). */
    async usageTotals(connectionId: string) {
      const row = await db
        .selectFrom("usage_log")
        .select((eb) => [
          eb.fn.countAll().as("requests"),
          eb.fn.sum("input_tokens").as("inputTokens"),
          eb.fn.sum("output_tokens").as("outputTokens"),
          eb.fn.max("created_at").as("lastUsedAt"),
        ])
        .where("connection_id", "=", connectionId)
        .executeTakeFirst();
      return {
        requests: Number(row?.requests ?? 0),
        inputTokens: Number(row?.inputTokens ?? 0),
        outputTokens: Number(row?.outputTokens ?? 0),
        lastUsedAt: (row?.lastUsedAt as string | null) ?? null,
      };
    },

    /**
     * One summary query per (connection, model) over a window — calls with
     * completed/failed split, token sums, avg + p95 latency, and cost
     * computed against the cached per-million prices (cost left null when the
     * model has no cached price). This single query feeds every dashboard
     * widget; no extra rollup tables.
     */
    async analyticsSummary(workspaceId: string, sinceIso: string, connectionId?: string) {
      const rows = await db
        .selectFrom("usage_log")
        .select((eb) => [
          "connection_id",
          "model",
          eb.fn.countAll().as("calls"),
          eb.fn.count("status").filterWhere("status", "=", "ok").as("completed"),
          eb.fn.count("status").filterWhere("status", "=", "error").as("failed"),
          eb.fn.coalesce(eb.fn.sum("input_tokens"), eb.lit(0)).as("inputTokens"),
          eb.fn.coalesce(eb.fn.sum("output_tokens"), eb.lit(0)).as("outputTokens"),
          eb.fn.avg("latency_ms").as("avgLatencyMs"),
          sql<number | null>`percentile_cont(0.95) within group (order by latency_ms)`.as("p95LatencyMs"),
        ])
        .where("workspace_id", "=", workspaceId)
        .where("created_at", ">=", sinceIso)
        .where("tool_name", "is", null)
        .$if(!!connectionId, (qb) => qb.where("connection_id", "=", connectionId!))
        .groupBy(["connection_id", "model"])
        .execute();

      return rows.map((r) => ({
        connectionId: r.connection_id,
        model: r.model,
        calls: Number(r.calls),
        completed: Number(r.completed),
        failed: Number(r.failed),
        inputTokens: Number(r.inputTokens),
        outputTokens: Number(r.outputTokens),
        avgLatencyMs: r.avgLatencyMs === null ? null : Math.round(Number(r.avgLatencyMs)),
        p95LatencyMs: r.p95LatencyMs === null ? null : Math.round(Number(r.p95LatencyMs)),
      }));
    },

    /**
     * Call counts per connection per DAY with completed/failed split — the
     * calls widget's yearly view. Bucketed on the database (date_trunc);
     * the client fills gaps.
     */
    async callsPerDay(workspaceId: string, sinceIso: string, connectionId?: string) {
      const rows = await db
        .selectFrom("usage_log")
        .select((eb) => [
          "connection_id",
          sql<string>`to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`.as("day"),
          eb.fn.countAll().as("calls"),
          eb.fn.count("status").filterWhere("status", "=", "ok").as("completed"),
          eb.fn.count("status").filterWhere("status", "=", "error").as("failed"),
        ])
        .where("workspace_id", "=", workspaceId)
        .where("created_at", ">=", sinceIso)
        .where("tool_name", "is", null)
        .$if(!!connectionId, (qb) => qb.where("connection_id", "=", connectionId!))
        .groupBy(["connection_id", sql`date_trunc('day', created_at)`])
        .execute();
      return rows.map((r) => ({
        connectionId: r.connection_id,
        day: r.day,
        calls: Number(r.calls),
        completed: Number(r.completed),
        failed: Number(r.failed),
      }));
    },

    /** Tool invocations grouped per tool name over a window — rows whose
     * tool_name is set. Count + completed/failed split. */
    async toolCalls(workspaceId: string, sinceIso: string, connectionId?: string) {
      const rows = await db
        .selectFrom("usage_log")
        .select((eb) => [
          "tool_name",
          eb.fn.countAll().as("calls"),
          eb.fn.count("status").filterWhere("status", "=", "ok").as("completed"),
          eb.fn.count("status").filterWhere("status", "=", "error").as("failed"),
        ])
        .where("workspace_id", "=", workspaceId)
        .where("created_at", ">=", sinceIso)
        .where("tool_name", "is not", null)
        .$if(!!connectionId, (qb) => qb.where("connection_id", "=", connectionId!))
        .groupBy("tool_name")
        .execute();
      return rows.map((r) => ({
        name: r.tool_name as string,
        calls: Number(r.calls),
        completed: Number(r.completed),
        failed: Number(r.failed),
      }));
    },

    // --- Quota snapshots ------------------------------------------------
    async listQuotas(connectionId: string) {
      return db.selectFrom("llm_quota").selectAll().where("connection_id", "=", connectionId).orderBy("quota_type", "asc").execute();
    },

    async listQuotasForWorkspace(workspaceId: string) {
      return db.selectFrom("llm_quota").selectAll().where("workspace_id", "=", workspaceId).orderBy("connection_id", "asc").orderBy("quota_type", "asc").execute();
    },

    async upsertQuota(input: {
      workspaceId: string;
      connectionId: string;
      quotaType: string;
      groupName: string;
      unit: string;
      quotaTotal: number | null;
      quotaUsed: number;
      resetAt: string | null;
    }) {
      const existing = await db
        .selectFrom("llm_quota")
        .select("id")
        .where("connection_id", "=", input.connectionId)
        .where("quota_type", "=", input.quotaType)
        .where("group_name", "=", input.groupName)
        .executeTakeFirst();
      const now = new Date().toISOString();
      if (existing) {
        await db
          .updateTable("llm_quota")
          .set({ unit: input.unit, quota_total: input.quotaTotal, quota_used: input.quotaUsed, captured_at: now, reset_at: input.resetAt })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await db
          .insertInto("llm_quota")
          .values({
            id: ulid(),
            workspace_id: input.workspaceId,
            connection_id: input.connectionId,
            quota_type: input.quotaType,
            group_name: input.groupName,
            unit: input.unit,
            quota_total: input.quotaTotal,
            quota_used: input.quotaUsed,
            captured_at: now,
            reset_at: input.resetAt,
          } as any)
          .execute();
      }
    },

    async replaceDefaultQuotas(connectionId: string, freshTypes: string[]) {
      // Snapshots of type X that the latest fetch no longer reports are stale
      // (e.g. a plan change dropped the extra-usage pool) — drop them.
      if (freshTypes.length === 0) return;
      await db
        .deleteFrom("llm_quota")
        .where("connection_id", "=", connectionId)
        .where("group_name", "=", "default")
        .where("quota_type", "not in", freshTypes)
        .execute();
    },

    // --- Model cache -----------------------------------------------------
    async listModels(connectionId: string) {
      return db.selectFrom("llm_model").selectAll().where("connection_id", "=", connectionId).orderBy("model_id", "asc").execute();
    },

    async replaceModels(
      connectionId: string,
      models: Array<{
        modelId: string;
        displayName: string | null;
        contextWindow: number | null;
        thinking: boolean;
        input: string[];
        thinkingLevel: string[];
        temperature: boolean;
        limitContext: number | null;
        limitInput: number | null;
        limitOutput: number | null;
        costInput: number | null;
        costOutput: number | null;
        costCacheRead: number | null;
        output: string[];
      }>,
    ) {
      await db.deleteFrom("llm_model").where("connection_id", "=", connectionId).execute();
      if (models.length === 0) return;
      await db
        .insertInto("llm_model")
        .values(
          models.map((m) => ({
            id: ulid(),
            connection_id: connectionId,
            model_id: m.modelId,
            display_name: m.displayName,
            context_window: m.contextWindow,
            thinking: m.thinking,
            input: JSON.stringify(m.input),
            thinking_level: JSON.stringify(m.thinkingLevel),
            temperature: m.temperature,
            limit_context: m.limitContext,
            limit_input: m.limitInput,
            limit_output: m.limitOutput,
            cost_input: m.costInput,
            cost_output: m.costOutput,
            cost_cache_read: m.costCacheRead,
            output: JSON.stringify(m.output),
            created_at: new Date().toISOString(),
          })) as any,
        )
        .execute();
    },
  };
}

export type ConnectionsRepo = ReturnType<typeof createConnectionsRepo>;
export type { QuotaRow };
