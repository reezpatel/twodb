import { sql, type Kysely } from "kysely";

/** A unit of work between a person and a collaborator bot in one channel. Closed by the agent (or after 24h idle). */
export interface CollabTaskRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  bot_id: string;
  status: "open" | "completed";
  /** Bumped by a rollback; replies/edits/status from an older epoch are dropped. */
  epoch: number;
  /** Artisan session of this task (informational — the "View code session" link). */
  session_id: string | null;
  /** The collaborator's private note from its last reply; seeds the next task after completion. */
  work_note: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export type CollabRunState = "queued" | "running" | "done" | "failed" | "stopped" | "rolled_back";

export interface CollabRunRow {
  id: string;
  task_id: string;
  workspace_id: string;
  channel_id: string;
  bot_id: string;
  epoch: number;
  state: CollabRunState;
  trigger_message_id: string;
  /** The last message already shown to the collaborator by a PREVIOUS run (resumed sessions only receive newer ones). */
  since_message_id: string | null;
  reply_message_id: string | null;
  deadline_at: string;
  created_at: string;
  finished_at: string | null;
}

export async function applyCollabSchema(db: Kysely<any>): Promise<void> {
  await sql`alter table bot add column if not exists runtime_app text`.execute(db);
  await sql`alter table bot add column if not exists runtime_ref text`.execute(db);
  await sql`alter table bot add column if not exists enabled boolean not null default true`.execute(db);
  await sql`alter table message add column if not exists collab jsonb`.execute(db);
  await sql`alter table message add column if not exists rolled_back_at timestamptz`.execute(db);
  await sql`create unique index if not exists bot_runtime_idx on bot (workspace_id, runtime_app, runtime_ref) where runtime_app is not null`.execute(db);

  await db.schema
    .createTable("collab_task")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("bot_id", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("open"))
    .addColumn("epoch", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("session_id", "text")
    .addColumn("work_note", "text")
    .addColumn("last_activity_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("collab_task_channel_idx").ifNotExists().on("collab_task").columns(["channel_id", "bot_id", "status"]).execute();
  await db.schema
    .createTable("collab_run")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("task_id", "text", (c) => c.notNull())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("bot_id", "text", (c) => c.notNull())
    .addColumn("epoch", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("state", "text", (c) => c.notNull().defaultTo("queued"))
    .addColumn("trigger_message_id", "text", (c) => c.notNull())
    .addColumn("since_message_id", "text")
    .addColumn("reply_message_id", "text")
    .addColumn("deadline_at", "timestamptz", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("finished_at", "timestamptz")
    .execute();
  await db.schema.createIndex("collab_run_task_idx").ifNotExists().on("collab_run").columns(["task_id", "id"]).execute();
  await sql`create index if not exists collab_run_state_idx on collab_run (state, deadline_at)`.execute(db);
}
