// @twodb/core-async/engine
//
// Generic, untyped-payload Postgres-backed queue + broadcast engine. One
// instance per app, bound to that app's own schema (per-app-schema per the
// decision log) — but the engine itself doesn't know or care what app it's
// running in, so future third-party/AI-authored apps can use it unchanged.
// Typed ergonomics (Zod payload shapes) live one layer up in `../registry`.

import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool, Client } from "pg";
import { ulid } from "ulid";

export interface AsyncEngineOptions {
  connectionString: string;
  /** This app's own Postgres schema — tables are created here, channel is namespaced by it. */
  schema: string;
}

interface QueueJobRow {
  id: string;
  type: string;
  payload: string; // JSON-encoded
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  max_attempts: number;
  run_at: string;
  locked_by: string | null;
  locked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  dedupe_key: string | null;
  lease_ms: number;
  locked_until: string | null;
}

interface QueueDb {
  _queue_jobs: QueueJobRow;
}

export interface EnqueueOptions {
  runAt?: Date;
  maxAttempts?: number;
  /**
   * Idempotency key, unique per job type. Enqueueing the same (type, dedupeKey) again is a no-op
   * that returns the existing job's id — the building block for at-least-once delivery.
   */
  dedupeKey?: string;
  /**
   * How long a claimed job may go without a heartbeat before it counts as dead (default 60s).
   * The worker heartbeats automatically while the handler runs, so this only has to cover a crashed
   * process, not a long-running handler.
   */
  leaseMs?: number;
}

export interface Job {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

/** Throw this (or any error with `permanent: true`) from a handler to fail the job without retrying. */
export class PermanentJobError extends Error {
  readonly permanent = true;
}

export type DeadJobHandler = (job: Job, error: string) => void | Promise<void>;

export interface WorkerOptions {
  pollIntervalMs?: number;
  concurrency?: number;
}

export interface BroadcastMessage<T = unknown> {
  event: string;
  payload: T;
}

export function createAsyncEngine(options: AsyncEngineOptions) {
  const pool = new Pool({
    connectionString: options.connectionString,
    options: `-c search_path=${JSON.stringify(options.schema).slice(1, -1)}`,
  });
  const db = new Kysely<QueueDb>({ dialect: new PostgresDialect({ pool }) });
  const channel = `${options.schema}_bus`;
  const workerId = `${options.schema}-${process.pid}-${ulid()}`;

  async function init() {
    await db.schema
      .createTable("_queue_jobs")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("type", "text", (c) => c.notNull())
      .addColumn("payload", "text", (c) => c.notNull())
      .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
      .addColumn("attempts", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("max_attempts", "integer", (c) => c.notNull().defaultTo(5))
      .addColumn("run_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
      .addColumn("locked_by", "text")
      .addColumn("locked_at", "timestamptz")
      .addColumn("last_error", "text")
      .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
      .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
      .addColumn("dedupe_key", "text")
      .addColumn("lease_ms", "integer", (c) => c.notNull().defaultTo(60_000))
      .addColumn("locked_until", "timestamptz")
      .execute();

    // Tables created before these columns existed.
    await sql`alter table _queue_jobs add column if not exists dedupe_key text`.execute(db);
    await sql`alter table _queue_jobs add column if not exists lease_ms integer not null default 60000`.execute(db);
    await sql`alter table _queue_jobs add column if not exists locked_until timestamptz`.execute(db);
    await sql`create unique index if not exists _queue_jobs_dedupe_idx on _queue_jobs (type, dedupe_key) where dedupe_key is not null`.execute(db);

    await db.schema
      .createIndex("_queue_jobs_poll_idx")
      .ifNotExists()
      .on("_queue_jobs")
      .columns(["status", "run_at"])
      .execute();
  }

  const deadHandlers: Array<{ types: string[] | "*"; handler: DeadJobHandler }> = [];

  async function notifyDead(row: QueueJobRow, error: string) {
    const job: Job = { id: row.id, type: row.type, payload: safeParse(row.payload), attempts: row.attempts, maxAttempts: row.max_attempts };
    for (const h of deadHandlers) {
      if (h.types !== "*" && !h.types.includes(row.type)) continue;
      try {
        await h.handler(job, error);
      } catch {
        // a failing dead-letter handler must never take the worker down
      }
    }
  }

  /**
   * Returns jobs whose worker stopped heartbeating to `pending` (with backoff), or to `failed` once
   * their attempts are used up — which is what makes a crash during a long job visible instead of
   * leaving it `processing` forever.
   */
  async function reap(): Promise<number> {
    const dead: Array<{ row: QueueJobRow; error: string }> = [];
    await db.transaction().execute(async (trx) => {
      const expired = await trx
        .selectFrom("_queue_jobs")
        .selectAll()
        .where("status", "=", "processing")
        .where(sql<boolean>`coalesce(locked_until, locked_at + interval '10 minutes') < now()`)
        .forUpdate()
        .skipLocked()
        .limit(50)
        .execute();
      for (const row of expired) {
        const exhausted = row.attempts >= row.max_attempts;
        await trx
          .updateTable("_queue_jobs")
          .set({
            status: exhausted ? "failed" : "pending",
            last_error: "lease expired (worker stopped responding)",
            run_at: exhausted ? row.run_at : new Date(Date.now() + backoffMs(row.attempts)).toISOString(),
            locked_by: null,
            locked_until: null,
            updated_at: new Date().toISOString(),
          } as any)
          .where("id", "=", row.id)
          .execute();
        if (exhausted) dead.push({ row, error: "lease expired (worker stopped responding)" });
      }
    });
    for (const d of dead) await notifyDead(d.row, d.error);
    return dead.length;
  }

  const queue = {
    reap,

    /** Called once for every job that ends up `failed` (retries exhausted, permanent error, or dead worker). */
    onDead(types: string[] | "*", handler: DeadJobHandler) {
      deadHandlers.push({ types, handler });
    },

    async enqueue(type: string, payload: unknown, opts: EnqueueOptions = {}): Promise<string> {
      const id = ulid();
      const inserted = await db
        .insertInto("_queue_jobs")
        .values({
          id,
          type,
          payload: JSON.stringify(payload),
          status: "pending",
          attempts: 0,
          max_attempts: opts.maxAttempts ?? 5,
          run_at: (opts.runAt ?? new Date()).toISOString(),
          locked_by: null,
          locked_at: null,
          last_error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          dedupe_key: opts.dedupeKey ?? null,
          lease_ms: opts.leaseMs ?? 60_000,
          locked_until: null,
        } as any)
        .onConflict((oc) => oc.columns(["type", "dedupe_key"] as any).where(sql<boolean>`dedupe_key is not null`).doNothing())
        .returning("id")
        .executeTakeFirst();
      if (inserted) return inserted.id;
      // Duplicate: hand back the job that already holds this key.
      const existing = await db.selectFrom("_queue_jobs").select("id").where("type", "=", type).where("dedupe_key", "=", opts.dedupeKey ?? "").executeTakeFirst();
      return existing?.id ?? id;
    },

    /** Current state of a job (for callers that need to know whether a dedupe hit already ran). */
    async getJob(id: string): Promise<{ id: string; status: QueueJobRow["status"]; attempts: number; lastError: string | null } | undefined> {
      const r = await db.selectFrom("_queue_jobs").select(["id", "status", "attempts", "last_error"]).where("id", "=", id).executeTakeFirst();
      return r ? { id: r.id, status: r.status, attempts: Number(r.attempts), lastError: r.last_error } : undefined;
    },

    /**
     * Starts a polling worker loop. `types` can be an explicit list or "*"
     * for every job type this app enqueues. Calling `.stop()` lets the
     * current batch finish before the loop exits.
     */
    worker(types: string[] | "*", handler: (job: Job) => Promise<void>, opts: WorkerOptions = {}) {
      const pollIntervalMs = opts.pollIntervalMs ?? 1000;
      const concurrency = opts.concurrency ?? 1;
      let stopped = false;

      async function claimOne(): Promise<QueueJobRow | undefined> {
        return db.transaction().execute(async (trx) => {
          let query = trx
            .selectFrom("_queue_jobs")
            .selectAll()
            .where("status", "=", "pending")
            .where("run_at", "<=", new Date().toISOString())
            .orderBy("run_at", "asc")
            .limit(1)
            .forUpdate()
            .skipLocked();

          if (types !== "*") {
            query = query.where("type", "in", types);
          }

          const row = await query.executeTakeFirst();
          if (!row) return undefined;

          await trx
            .updateTable("_queue_jobs")
            .set({
              status: "processing",
              locked_by: workerId,
              locked_at: new Date().toISOString(),
              locked_until: new Date(Date.now() + row.lease_ms).toISOString(),
              attempts: row.attempts + 1,
              updated_at: new Date().toISOString(),
            })
            .where("id", "=", row.id)
            .execute();

          return row;
        });
      }

      let lastReap = 0;
      async function maybeReap() {
        if (Date.now() - lastReap < 10_000) return;
        lastReap = Date.now();
        await reap().catch(() => undefined);
      }

      async function runLoop() {
        while (!stopped) {
          await maybeReap();
          const row = await claimOne().catch(() => undefined);
          if (!row) {
            await sleep(pollIntervalMs);
            continue;
          }
          // Keep the lease alive while the handler runs; a crashed process stops doing this and the reaper takes over.
          const beat = setInterval(() => {
            void db
              .updateTable("_queue_jobs")
              .set({ locked_until: new Date(Date.now() + row.lease_ms).toISOString() } as any)
              .where("id", "=", row.id)
              .where("status", "=", "processing")
              .execute()
              .catch(() => undefined);
          }, Math.max(1_000, Math.floor(row.lease_ms / 3)));
          try {
            await handler({ id: row.id, type: row.type, payload: safeParse(row.payload), attempts: row.attempts + 1, maxAttempts: row.max_attempts });
            clearInterval(beat);
            await db
              .updateTable("_queue_jobs")
              .set({ status: "completed", locked_until: null, updated_at: new Date().toISOString() } as any)
              .where("id", "=", row.id)
              .execute();
          } catch (err) {
            clearInterval(beat);
            const permanent = Boolean((err as { permanent?: boolean })?.permanent);
            const failed = permanent || row.attempts + 1 >= row.max_attempts;
            await db
              .updateTable("_queue_jobs")
              .set({
                status: failed ? "failed" : "pending",
                last_error: String(err),
                run_at: failed ? row.run_at : new Date(Date.now() + backoffMs(row.attempts + 1)).toISOString(),
                locked_by: null,
                locked_until: null,
                updated_at: new Date().toISOString(),
              } as any)
              .where("id", "=", row.id)
              .execute();
            if (failed) await notifyDead({ ...row, attempts: row.attempts + 1 }, String(err));
          }
        }
      }

      const loops = Array.from({ length: concurrency }, () => runLoop());
      return {
        stop: async () => {
          stopped = true;
          await Promise.all(loops);
        },
      };
    },
  };

  const broadcast = {
    /** Publishes via Postgres NOTIFY. Keep payloads small (~8KB NOTIFY limit) — an id/envelope, not the full record. */
    async publish<T>(event: string, payload: T): Promise<void> {
      const message: BroadcastMessage<T> = { event, payload };
      await db.executeQuery(
        sql`select pg_notify(${channel}, ${JSON.stringify(message)})`.compile(db),
      );
    },

    /** Subscribes via a dedicated LISTEN connection. Returns `{stop}` to unsubscribe and close the connection. */
    async subscribe(handler: (message: BroadcastMessage) => void) {
      const client = new Client({ connectionString: options.connectionString });
      await client.connect();
      await client.query(`LISTEN ${client.escapeIdentifier(channel)}`);
      client.on("notification", (msg) => {
        if (!msg.payload) return;
        try {
          handler(JSON.parse(msg.payload));
        } catch {
          // malformed payload — drop it, never crash the subscriber loop
        }
      });
      return {
        stop: async () => {
          await client.query(`UNLISTEN ${client.escapeIdentifier(channel)}`).catch(() => {});
          await client.end();
        },
      };
    },
  };

  return { db, init, queue, broadcast, close: () => pool.end() };
}

function backoffMs(attempt: number): number {
  return Math.min(60_000, 1000 * 2 ** attempt);
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AsyncEngine = ReturnType<typeof createAsyncEngine>;
