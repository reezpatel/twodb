import { sql, type Kysely } from "@twodb/core-data/db";

export interface LlmConnectionRow {
  id: string;
  workspace_id: string;
  space_id: string;
  name: string;
  /** Provider id from the catalog (src/providers/catalog.ts). */
  provider: string;
  base_url: string;
  /** AES-256-GCM encrypted (see src/crypto.ts) — never stored or returned in plaintext. */
  api_key: string;
  default_model: string | null;
  /** Extra provider-specific fields (org, accountId, sessionToken, OAuth
   * tokens, expires_at) — secrets encrypted as one blob. */
  config: string | null;
  created_at: string;
}

export interface UsageLogRow {
  id: string;
  connection_id: string;
  workspace_id: string;
  model: string;
  status: "ok" | "error";
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number;
  /** Set when this row records a TOOL invocation rather than a completion —
   * either a tool_call parsed from a completion response, or a direct
   * /tools/invoke log. Null for plain completions. */
  tool_name: string | null;
  created_at: string;
}

export interface QuotaRow {
  id: string;
  workspace_id: string;
  connection_id: string;
  quota_type: string;
  group_name: string;
  unit: string;
  quota_total: number | null;
  quota_used: number;
  captured_at: string;
  reset_at: string | null;
}

export interface ModelRow {
  id: string;
  connection_id: string;
  model_id: string;
  display_name: string | null;
  context_window: number | null;
  thinking: boolean;
  input: string;
  thinking_level: string;
  temperature: boolean;
  limit_context: number | null;
  limit_input: number | null;
  limit_output: number | null;
  cost_input: number | null;
  cost_output: number | null;
  cost_cache_read: number | null;
  output: string;
  created_at: string;
}

export interface TwoRouteDb {
  llm_connection: LlmConnectionRow;
  usage_log: UsageLogRow;
  llm_quota: QuotaRow;
  llm_model: ModelRow;
}

export async function applySchema(db: Kysely<TwoRouteDb>): Promise<void> {
  await db.schema
    .createTable("llm_connection")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("space_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("provider", "text", (c) => c.notNull())
    .addColumn("base_url", "text", (c) => c.notNull())
    .addColumn("api_key", "text", (c) => c.notNull())
    .addColumn("default_model", "text")
    .addColumn("config", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("llm_connection_space_idx")
    .ifNotExists()
    .on("llm_connection")
    .columns(["space_id"])
    .execute();

  await db.schema
    .createIndex("llm_connection_workspace_name_idx")
    .ifNotExists()
    .on("llm_connection")
    .columns(["workspace_id", "name"])
    .unique()
    .execute();

  await db.schema
    .createTable("usage_log")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    // Deliberately NOT a foreign key: deleting a connection keeps its usage
    // history (audit/billing), so connection_id is a soft reference.
    .addColumn("connection_id", "text", (c) => c.notNull())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("model", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("input_tokens", "integer")
    .addColumn("output_tokens", "integer")
    .addColumn("latency_ms", "integer", (c) => c.notNull())
    .addColumn("tool_name", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("usage_log_connection_created_idx")
    .ifNotExists()
    .on("usage_log")
    .columns(["connection_id", "created_at"])
    .execute();

  await db.schema
    .createTable("llm_quota")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("connection_id", "text", (c) => c.notNull())
    .addColumn("quota_type", "text", (c) => c.notNull())
    .addColumn("group_name", "text", (c) => c.notNull())
    .addColumn("unit", "text", (c) => c.notNull())
    .addColumn("quota_total", "double precision")
    .addColumn("quota_used", "double precision", (c) => c.notNull())
    .addColumn("captured_at", "timestamptz", (c) => c.notNull())
    .addColumn("reset_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("llm_quota_connection_type_idx")
    .ifNotExists()
    .on("llm_quota")
    .columns(["connection_id", "quota_type", "group_name"])
    .unique()
    .execute();

  await db.schema
    .createTable("llm_model")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("connection_id", "text", (c) => c.notNull())
    .addColumn("model_id", "text", (c) => c.notNull())
    .addColumn("display_name", "text")
    .addColumn("context_window", "integer")
    .addColumn("thinking", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("input", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("thinking_level", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("temperature", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("limit_context", "integer")
    .addColumn("limit_input", "integer")
    .addColumn("limit_output", "integer")
    .addColumn("cost_input", "double precision")
    .addColumn("cost_output", "double precision")
    .addColumn("cost_cache_read", "double precision")
    .addColumn("output", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("llm_model_connection_idx")
    .ifNotExists()
    .on("llm_model")
    .columns(["connection_id", "model_id"])
    .unique()
    .execute();

  // config column added late (2026-11): backfill for existing dev DBs.
  await sql`alter table llm_connection add column if not exists config text`.execute(db);
  // tool_name added late (2026-11): same for the usage log.
  await sql`alter table usage_log add column if not exists tool_name text`.execute(db);
}
