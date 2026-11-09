import { sql, type Kysely } from "@twodb/core-data/db";

export interface LlmConnectionRow {
  id: string;
  workspace_id: string;
  space_id: string;
  name: string;
  /** "openai-compatible" | "anthropic" */
  provider: string;
  base_url: string;
  /** Encrypted at rest by the gateway layer in a future hardening pass — see AGENTS.md. */
  api_key: string;
  default_model: string | null;
  created_at: string;
}

export interface TwoRouteDb {
  llm_connection: LlmConnectionRow;
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
}
