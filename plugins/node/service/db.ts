import { sql } from "kysely";
import type { Generated, Kysely } from "kysely";

export interface NodeTables {
  node_nodes: {
    id: Generated<string>;
    name: string;
    platform: Generated<string>;
    hostname: Generated<string>;
    arch: Generated<string>;
    agent_version: Generated<string>;
    labels: Generated<Record<string, string>>;
    status: Generated<string>;
    last_seen_at: Generated<Date | null>;
    token_hash: string;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  node_commands: {
    id: Generated<string>;
    node_id: string;
    command: string;
    cwd: string | null;
    status: Generated<string>;
    exit_code: number | null;
    error: string | null;
    workspace_id: string | null;
    user_id: string | null;
    created_at: Generated<Date>;
    started_at: Date | null;
    finished_at: Date | null;
  };
  node_patches: {
    id: Generated<string>;
    node_id: string;
    path: string;
    status: Generated<string>;
    hash: string | null;
    error: string | null;
    created_at: Generated<Date>;
    finished_at: Date | null;
  };
}

export interface NodeDatabase extends NodeTables {}

export async function up(db: Kysely<NodeDatabase>): Promise<void> {
  await db.schema
    .createTable("node_nodes")
    .addColumn("id", "uuid", (col) => col.defaultTo(sql`gen_random_uuid()`).primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("platform", "text", (col) => col.notNull().defaultTo("unknown"))
    .addColumn("hostname", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("arch", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("agent_version", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("labels", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("status", "text", (col) => col.notNull().defaultTo("unknown"))
    .addColumn("last_seen_at", "timestamptz")
    .addColumn("token_hash", "text", (col) => col.notNull().unique())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("node_commands")
    .addColumn("id", "uuid", (col) => col.defaultTo(sql`gen_random_uuid()`).primaryKey())
    .addColumn("node_id", "uuid", (col) => col.references("node_nodes.id").onDelete("cascade").notNull())
    .addColumn("command", "text", (col) => col.notNull())
    .addColumn("cwd", "text")
    .addColumn("status", "text", (col) => col.notNull().defaultTo("queued"))
    .addColumn("exit_code", "integer")
    .addColumn("error", "text")
    .addColumn("workspace_id", "text")
    .addColumn("user_id", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("started_at", "timestamptz")
    .addColumn("finished_at", "timestamptz")
    .execute();

  await db.schema.createIndex("node_commands_node_created_idx").on("node_commands").columns(["node_id", "created_at"]).execute();

  await db.schema
    .createTable("node_patches")
    .addColumn("id", "uuid", (col) => col.defaultTo(sql`gen_random_uuid()`).primaryKey())
    .addColumn("node_id", "uuid", (col) => col.references("node_nodes.id").onDelete("cascade").notNull())
    .addColumn("path", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("hash", "text")
    .addColumn("error", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("finished_at", "timestamptz")
    .execute();
}

export async function down(db: Kysely<NodeDatabase>): Promise<void> {
  await db.schema.dropTable("node_patches").ifExists().execute();
  await db.schema.dropTable("node_commands").ifExists().execute();
  await db.schema.dropTable("node_nodes").ifExists().execute();
}

export const nodeMigrations = { "0001_init": { up, down } };
