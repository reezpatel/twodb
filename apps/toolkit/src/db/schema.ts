import { sql, type Kysely } from "@twodb/core-data/db";

/** A user-registered external MCP server (any http/sse endpoint). Config +
 *  scope for now — Artisan keeps its own copy until it migrates here. */
export interface McpServerRow {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  /** auto | http | sse */
  transport: string;
  headers_json: string;
  enabled: number;
  /** all | spaces */
  scope_mode: string;
  scope_all: number;
  scope_ids_json: string;
  /** Empty = visible to every agent; else only these Artisan agent ids. */
  agent_ids_json: string;
  created_at: string;
  updated_at: string;
}

/** A configured instance of a connector template (template id is code-owned;
 *  many instances of the same template may exist). */
export interface ConnectorInstanceRow {
  id: string;
  workspace_id: string;
  template_id: string;
  name: string;
  /** JSON object of fieldKey → value; secret fields AES-GCM encrypted individually. */
  config_json: string;
  enabled: number;
  /** all | spaces */
  scope_mode: string;
  scope_all: number;
  scope_ids_json: string;
  /** Empty = visible to every agent; else only these Artisan agent ids. */
  agent_ids_json: string;
  /** Last health-check outcome: ok | error | null (never run). */
  health_status: string | null;
  health_error: string | null;
  health_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A durable queue another app requested for a connector's broadcasts —
 *  events fan out to the pg_notify broadcast AND are inserted here, because
 *  broadcasts can be dropped. */
export interface EventQueueRow {
  id: string;
  workspace_id: string;
  instance_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

/** One queued broadcast (payload as published). */
export interface EventQueueItemRow {
  id: string;
  queue_id: string;
  workspace_id: string;
  event: string;
  payload_json: string;
  /** pending | delivered */
  status: string;
  created_at: string;
  delivered_at: string | null;
}

/** Broadcast log — what the connector emitted (also the SSE backlog source). */
export interface BroadcastRow {
  id: string;
  workspace_id: string;
  instance_id: string;
  event: string;
  payload_json: string;
  created_at: string;
}

/** Poller bookkeeping per instance: interval cursor / hashed state. */
export interface ConnectorStateRow {
  instance_id: string;
  workspace_id: string;
  /** Template-defined state blob (JSON) — e.g. Plane's issue fingerprint map. */
  state_json: string;
  updated_at: string;
}

export interface ToolkitDb {
  mcp_server: McpServerRow;
  connector_instance: ConnectorInstanceRow;
  event_queue: EventQueueRow;
  event_queue_item: EventQueueItemRow;
  broadcast: BroadcastRow;
  connector_state: ConnectorStateRow;
}

export async function applySchema(db: Kysely<ToolkitDb>): Promise<void> {
  await db.schema
    .createTable("mcp_server")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("url", "text", (c) => c.notNull())
    .addColumn("transport", "text", (c) => c.notNull().defaultTo("auto"))
    .addColumn("headers_json", "text", (c) => c.notNull().defaultTo("{}"))
    .addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("scope_mode", "text", (c) => c.notNull().defaultTo("all"))
    .addColumn("scope_all", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("scope_ids_json", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("agent_ids_json", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("mcp_server_workspace_idx").ifNotExists().on("mcp_server").column("workspace_id").execute();
  await db.schema.createIndex("mcp_server_workspace_name_idx").ifNotExists().on("mcp_server").columns(["workspace_id", "name"]).unique().execute();

  await db.schema
    .createTable("connector_instance")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("template_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("config_json", "text", (c) => c.notNull().defaultTo("{}"))
    .addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("scope_mode", "text", (c) => c.notNull().defaultTo("all"))
    .addColumn("scope_all", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("scope_ids_json", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("agent_ids_json", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("health_status", "text")
    .addColumn("health_error", "text")
    .addColumn("health_checked_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("connector_instance_workspace_idx").ifNotExists().on("connector_instance").column("workspace_id").execute();
  await db.schema.createIndex("connector_instance_workspace_name_idx").ifNotExists().on("connector_instance").columns(["workspace_id", "name"]).unique().execute();
  await db.schema.createIndex("connector_instance_template_idx").ifNotExists().on("connector_instance").columns(["workspace_id", "template_id"]).execute();

  await db.schema
    .createTable("event_queue")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("instance_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("created_by", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("event_queue_instance_idx").ifNotExists().on("event_queue").columns(["instance_id", "name"]).unique().execute();

  await db.schema
    .createTable("event_queue_item")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("queue_id", "text", (c) => c.notNull())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("event", "text", (c) => c.notNull())
    .addColumn("payload_json", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("delivered_at", "timestamptz")
    .execute();
  await db.schema.createIndex("event_queue_item_queue_idx").ifNotExists().on("event_queue_item").columns(["queue_id", "created_at"]).execute();

  await db.schema
    .createTable("broadcast")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("instance_id", "text", (c) => c.notNull())
    .addColumn("event", "text", (c) => c.notNull())
    .addColumn("payload_json", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("broadcast_instance_idx").ifNotExists().on("broadcast").columns(["instance_id", "created_at"]).execute();
  await db.schema.createIndex("broadcast_event_idx").ifNotExists().on("broadcast").columns(["workspace_id", "event", "created_at"]).execute();

  await db.schema
    .createTable("connector_state")
    .ifNotExists()
    .addColumn("instance_id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("state_json", "text", (c) => c.notNull().defaultTo("{}"))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  // agent access (2026-11): backfill for dev DBs created before the column existed.
  await sql`alter table mcp_server add column if not exists agent_ids_json text not null default '[]'`.execute(db);
  await sql`alter table connector_instance add column if not exists agent_ids_json text not null default '[]'`.execute(db);
}
