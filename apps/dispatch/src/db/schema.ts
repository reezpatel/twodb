import { type Kysely } from "@twodb/core-data/db";

/** A registered machine that dials in over WS and executes commands.
 *  `token_hash` holds sha256(runner key) — the plaintext key is shown once
 *  at creation, exactly like TwoDB's app registration tokens. */
export interface RunnerRow {
  id: string;
  workspace_id: string;
  /** Workspace-unique friendly identifier chosen by the runner (or
   *  assigned on first connect), e.g. "divine", "buildbox-2". */
  name: string;
  token_hash: string;
  /** Host-reported: os, arch, hostname, version — refreshed on connect. */
  meta_json: string;
  /** "host" (runs commands directly) or "microvm-host" (can boot Firecracker VMs). */
  kind: "host" | "microvm-host";
  status: "online" | "offline";
  last_seen_at: string | null;
  created_at: string;
}

/** A long-running command owned by a runner (jobs API). Status + logs. */
export interface JobRow {
  id: string;
  workspace_id: string;
  runner_id: string;
  /** Caller-supplied grouping key — resource this job operates on. */
  resource_id: string | null;
  command: string;
  /** "running" | "completed" | "failed" | "terminated" */
  status: "running" | "completed" | "failed" | "terminated";
  exit_code: number | null;
  started_at: string;
  ended_at: string | null;
}

/** Append-only log lines for a job (tailing = ordered scan, SSE follow =
 *  poll for new rows). */
export interface JobLogRow {
  seq: number;
  job_id: string;
  stream: "stdout" | "stderr";
  line: string;
  at: string;
}

/** One output chunk of a streamed `call` (kept so calls can be replayed /
 *  audited; rows are pruned with the job logs). */
export interface ExecLogRow {
  id: string;
  workspace_id: string;
  runner_id: string;
  resource_id: string | null;
  command: string;
  stream: "stdout" | "stderr";
  chunk: string;
  at: string;
}

/** An ephemeral Firecracker microvm owned by a runner. */
export interface MicrovmRow {
  id: string;
  workspace_id: string;
  runner_id: string;
  /** Stable identifier callers target — resuming the same id restores /app
   *  from the archived zip and boots a fresh VM. */
  identifier: string;
  /** "running" | "idle-stopped" | "archived" | "failed" */
  status: "running" | "idle-stopped" | "archived" | "failed";
  /** Host-side CID the vsock listener uses. */
  cid: number | null;
  boot_count: number;
  last_active_at: string;
  created_at: string;
  /** Set when status=archived — after the inactivity window the row is
   *  deleted and only the (mocked) S3 zip remains. */
  archived_at: string | null;
  meta_json: string;
}

export interface DispatchDb {
  runner: RunnerRow;
  job: JobRow;
  job_log: JobLogRow;
  exec_log: ExecLogRow;
  microvm: MicrovmRow;
}

export async function applySchema(db: Kysely<DispatchDb>): Promise<void> {
  await db.schema.createSchema("dispatch").ifNotExists().execute();

  await db.schema
    .createTable("runner")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull().unique())
    .addColumn("token_hash", "text", (c) => c.notNull())
    .addColumn("meta_json", "text", (c) => c.notNull().defaultTo("{}"))
    .addColumn("kind", "text", (c) => c.notNull().defaultTo("host"))
    .addColumn("status", "text", (c) => c.notNull().defaultTo("offline"))
    .addColumn("last_seen_at", "text")
    .addColumn("created_at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("job")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("runner_id", "text", (c) => c.notNull())
    .addColumn("resource_id", "text")
    .addColumn("command", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("running"))
    .addColumn("exit_code", "integer")
    .addColumn("started_at", "text", (c) => c.notNull())
    .addColumn("ended_at", "text")
    .execute();

  await db.schema
    .createTable("job_log")
    .ifNotExists()
    .addColumn("seq", "bigint", (c) => c.notNull())
    .addColumn("job_id", "text", (c) => c.notNull())
    .addColumn("stream", "text", (c) => c.notNull())
    .addColumn("line", "text", (c) => c.notNull())
    .addColumn("at", "text", (c) => c.notNull())
    .execute();

  // One log table per (job, seq): strict ordering without an id primary key.
  await db.schema
    .createIndex("job_log_job_seq_idx")
    .ifNotExists()
    .on("job_log")
    .columns(["job_id", "seq"])
    .execute();

  await db.schema
    .createTable("exec_log")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("runner_id", "text", (c) => c.notNull())
    .addColumn("resource_id", "text")
    .addColumn("command", "text", (c) => c.notNull())
    .addColumn("stream", "text", (c) => c.notNull())
    .addColumn("chunk", "text", (c) => c.notNull())
    .addColumn("at", "text", (c) => c.notNull())
    .execute();

  await db.schema
    .createTable("microvm")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("runner_id", "text", (c) => c.notNull())
    .addColumn("identifier", "text", (c) => c.notNull().unique())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("running"))
    .addColumn("cid", "integer")
    .addColumn("boot_count", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("last_active_at", "text", (c) => c.notNull())
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("archived_at", "text")
    .addColumn("meta_json", "text", (c) => c.notNull().defaultTo("{}"))
    .execute();

}
