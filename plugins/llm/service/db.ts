import { sql } from "kysely";
import type { Generated, Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import type { TwodbLlmWorkspaceSettings } from "@twodb/contracts";
import type { TwodbContext } from "@twodb/shared-backend";
import { coerceSettings, DEFAULT_WORKSPACE_SETTINGS } from "./settings";

type ConnectionRow = {
  id: string;
  workspace_id: string;
  provider: string;
  name: string;
  config: Record<string, unknown> | null;
  overrides: Record<string, unknown> | null;
  enabled: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
};

type SelectedConnection = Omit<ConnectionRow, "enabled" | "created_at" | "updated_at"> & {
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

type SettingsRow = {
  workspace_id: string;
  effective_context_window_percent: number;
  truncation_policy: Record<string, unknown> | null;
  default_model: Record<string, unknown> | null;
  queue: Record<string, unknown> | null;
};

type LlmDb = { llm_connections: ConnectionRow; llm_workspace_settings: SettingsRow };

export type { ConnectionRow, LlmDb, SelectedConnection, SettingsRow };

export const db = (ctx: TwodbContext) => ctx.db as unknown as Kysely<LlmDb>;

export async function readSettings(kysely: Kysely<LlmDb>, workspaceId: string): Promise<TwodbLlmWorkspaceSettings> {
  const row = await kysely.selectFrom("llm_workspace_settings").selectAll().where("workspace_id", "=", workspaceId).executeTakeFirst();
  return row ? coerceSettings(row) : DEFAULT_WORKSPACE_SETTINGS;
}

const init: Migration = {
  async up(db) {
    await db.schema
      .createTable("llm_connections")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("workspace_id", "text", (col) => col.notNull())
      .addColumn("provider", "text", (col) => col.notNull())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("config", sql`jsonb`, (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
      .addColumn("overrides", sql`jsonb`)
      .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(true))
      .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
      .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
      .execute();

    await db.schema.createIndex("llm_connections_workspace_idx").on("llm_connections").columns(["workspace_id"]).execute();

    await db.schema
      .createTable("llm_workspace_settings")
      .addColumn("workspace_id", "text", (col) => col.primaryKey())
      .addColumn("effective_context_window_percent", "integer", (col) => col.notNull().defaultTo(90))
      .addColumn("truncation_policy", sql`jsonb`, (col) => col.notNull().defaultTo(sql`'{"type":"keep_system_first"}'::jsonb`))
      .addColumn("default_model", sql`jsonb`)
      .addColumn("queue", sql`jsonb`, (col) => col.notNull().defaultTo(sql`'{"max_wait_ms":120000}'::jsonb`))
      .execute();
  },
  async down(db) {
    await db.schema.dropTable("llm_connections").ifExists().execute();
    await db.schema.dropTable("llm_workspace_settings").ifExists().execute();
  },
};

export const llmMigrations: Record<string, Migration> = { "0001_init": init };
