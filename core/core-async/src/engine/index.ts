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
}

interface QueueDb {
  _queue_jobs: QueueJobRow;
}

export interface EnqueueOptions {
  runAt?: Date;
  maxAttempts?: number;
}

export interface Job {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
}

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
      .execute();

    await db.schema
      .createIndex("_queue_jobs_poll_idx")
      .ifNotExists()
      .on("_queue_jobs")
      .columns(["status", "run_at"])
      .execute();
  }

  const queue = {
    async enqueue(type: string, payload: unknown, opts: EnqueueOptions = {}): Promise<string> {
      const id = ulid();
      await db
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
        } as any)
        .execute();
      return id;
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
              attempts: row.attempts + 1,
              updated_at: new Date().toISOString(),
            })
            .where("id", "=", row.id)
            .execute();

          return row;
        });
      }

      async function runLoop() {
        while (!stopped) {
          const row = await claimOne().catch(() => undefined);
          if (!row) {
            await sleep(pollIntervalMs);
            continue;
          }
          try {
            await handler({ id: row.id, type: row.type, payload: JSON.parse(row.payload), attempts: row.attempts + 1 });
            await db
              .updateTable("_queue_jobs")
              .set({ status: "completed", updated_at: new Date().toISOString() })
              .where("id", "=", row.id)
              .execute();
          } catch (err) {
            const failed = row.attempts + 1 >= row.max_attempts;
            await db
              .updateTable("_queue_jobs")
              .set({
                status: failed ? "failed" : "pending",
                last_error: String(err),
                run_at: failed ? row.run_at : new Date(Date.now() + backoffMs(row.attempts + 1)).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .where("id", "=", row.id)
              .execute();
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type AsyncEngine = ReturnType<typeof createAsyncEngine>;
