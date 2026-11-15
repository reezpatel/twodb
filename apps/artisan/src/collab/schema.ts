import { sql, type Kysely } from "kysely";

/** One conversation-sized unit of work for a collaborator. `id` is TwoChat's task id. */
export interface CollabTaskRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  agent_id: string;
  /** The task's Artisan session; null until the first run, and after a rollback that can't rewind it. */
  session_id: string | null;
  /** Bumped by TwoChat on rollback; replies carry it so stale ones are dropped on the other side. */
  epoch: number;
  /** Work note of the last finished run — seeds the next task's session after completion. */
  work_note: string | null;
  created_at: string;
  updated_at: string;
}

export type CollabRunState = "queued" | "running" | "done" | "failed" | "cancelled" | "superseded" | "rolled_back";

export interface CollabRunRow {
  /** TwoChat's run id (a ulid, so lexical order = creation order). */
  run_id: string;
  task_id: string;
  workspace_id: string;
  agent_id: string;
  channel_id: string;
  epoch: number;
  state: CollabRunState;
  session_id: string | null;
  /** Thread + message index the session had BEFORE this run — rollback truncates to here. */
  thread_id: string | null;
  start_idx: number | null;
  /** Git checkpoint taken before the run (null for non-git directories). */
  checkpoint_ref: string | null;
  checkpoint_sha: string | null;
  /** The raw `artisan.collab.run` payload (snapshot included) — Artisan never re-reads TwoChat. */
  payload_json: string;
  trigger_message_id: string | null;
  /** Set once send_reply succeeded. */
  replied: number;
  /** Id of the TwoChat message this run posted (chosen by Artisan so edit_reply can address it). */
  reply_message_id: string | null;
  /** Superseded-by run id, or the error text for failed runs. */
  note: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export async function applyCollabSchema(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("collab_task")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("agent_id", "text", (c) => c.notNull())
    .addColumn("session_id", "text")
    .addColumn("epoch", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("work_note", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("updated_at", "text", (c) => c.notNull())
    .execute();
  await db.schema
    .createTable("collab_run")
    .ifNotExists()
    .addColumn("run_id", "text", (c) => c.primaryKey())
    .addColumn("task_id", "text", (c) => c.notNull())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("agent_id", "text", (c) => c.notNull())
    .addColumn("channel_id", "text", (c) => c.notNull())
    .addColumn("epoch", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("state", "text", (c) => c.notNull().defaultTo("queued"))
    .addColumn("session_id", "text")
    .addColumn("thread_id", "text")
    .addColumn("start_idx", "integer")
    .addColumn("checkpoint_ref", "text")
    .addColumn("checkpoint_sha", "text")
    .addColumn("payload_json", "text", (c) => c.notNull())
    .addColumn("trigger_message_id", "text")
    .addColumn("replied", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("reply_message_id", "text")
    .addColumn("note", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("started_at", "text")
    .addColumn("finished_at", "text")
    .execute();
  await db.schema.createIndex("collab_run_task_idx").ifNotExists().on("collab_run").columns(["task_id", "run_id"]).execute();
  await sql`create index if not exists collab_run_state_idx on collab_run (state)`.execute(db);
}
