import { sql, type Kysely } from "@twodb/core-data/db";

export interface LlmConnectionRow {
  id: string;
  workspace_id: string;
  space_id: string;
  name: string;
  /** "openai-compatible" | "anthropic" */
  provider: string;
  base_url: string;
  /** AES-256-GCM encrypted (see src/crypto.ts) — never stored or returned in plaintext. */
  api_key: string;
  default_model: string | null;
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
  created_at: string;
}

export interface TwoRouteDb {
  llm_connection: LlmConnectionRow;
  usage_log: UsageLogRow;
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
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("usage_log_connection_created_idx")
    .ifNotExists()
    .on("usage_log")
    .columns(["connection_id", "created_at"])
    .execute();
}
