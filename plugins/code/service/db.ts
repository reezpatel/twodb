import { sql } from "kysely";
import type { Generated, Kysely } from "kysely";

export interface CodeTables {
  code_sessions: {
    id: Generated<string>;
    workspace_id: string;
    node_id: string;
    title: string;
    folder: string;
    connection_id: string | null;
    model: Generated<string | null>;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  code_session_messages: {
    id: Generated<string>;
    session_id: string;
    run_id: string | null;
    role: string;
    content: string | null;
    tool_calls: Generated<unknown[] | null>;
    tool_call_id: string | null;
    name: string | null;
    created_at: Generated<Date>;
  };
}

export async function up(db: Kysely<CodeTables>): Promise<void> {
  await db.schema
    .createTable("code_sessions")
    .addColumn("id", "uuid", (col) => col.defaultTo(sql`gen_random_uuid()`).primaryKey())
    .addColumn("workspace_id", "text", (col) => col.notNull())
    .addColumn("node_id", "text", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("folder", "text", (col) => col.notNull())
    .addColumn("connection_id", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex("code_sessions_workspace_idx").on("code_sessions").columns(["workspace_id", "updated_at"]).execute();

  await db.schema
    .createTable("code_session_messages")
    .addColumn("id", "uuid", (col) => col.defaultTo(sql`gen_random_uuid()`).primaryKey())
    .addColumn("session_id", "uuid", (col) => col.references("code_sessions.id").onDelete("cascade").notNull())
    .addColumn("run_id", "text")
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("content", "text")
    .addColumn("tool_calls", "jsonb")
    .addColumn("tool_call_id", "text")
    .addColumn("name", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex("code_session_messages_session_idx").on("code_session_messages").columns(["session_id", "created_at"]).execute();
}

export async function down(db: Kysely<CodeTables>): Promise<void> {
  await db.schema.dropTable("code_session_messages").ifExists().execute();
  await db.schema.dropTable("code_sessions").ifExists().execute();
}

async function up0002(db: Kysely<CodeTables>): Promise<void> {
  await db.schema.alterTable("code_sessions").addColumn("model", "text").execute();
}

async function down0002(db: Kysely<CodeTables>): Promise<void> {
  await db.schema.alterTable("code_sessions").dropColumn("model").execute();
}

export const codeMigrations = {
  "0001_init": { up, down },
  "0002_session_model": { up: up0002, down: down0002 },
};
