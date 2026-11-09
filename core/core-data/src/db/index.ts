// @twodb/core-data/db
//
// Runtime database clients only. No provisioning logic lives here — creating
// an app's Postgres schema/role is TwoDB's job (apps/twodb). This module just
// gives an app a typed Kysely handle to the schema TwoDB already provisioned
// for it, plus a local-SQLite factory for apps that keep their own state
// (e.g. TwoDB's own control-plane store).

import { Kysely, PostgresDialect, SqliteDialect, sql, type Generated } from "kysely";
import { Pool } from "pg";
import Database from "better-sqlite3";
import * as path from "node:path";
import * as fs from "node:fs";
import { promises as fsp } from "node:fs";

export interface PgDbOptions {
  /** Postgres connection string, e.g. postgres://user:pass@host:5432/twodb */
  connectionString: string;
  /**
   * The schema this app was provisioned with (one schema per app, owned by
   * TwoDB). All queries from this client are implicitly scoped to it via
   * search_path — the app never needs to qualify table names with a schema.
   */
  schema: string;
  /** Max pool size (default 10). */
  max?: number;
}

/**
 * Creates a Kysely client bound to one Postgres schema. Call once per
 * process and share the instance; do not create a pool per request.
 */
export function createPgDb<DB>(options: PgDbOptions): Kysely<DB> {
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.max ?? 10,
    options: `-c search_path=${JSON.stringify(options.schema).slice(1, -1)}`,
  });

  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
  });
}

export interface SqliteDbOptions {
  /** Path to the sqlite file. Parent directories are created if missing. */
  file: string;
}

/**
 * Creates a Kysely client over a local SQLite file. Used by apps that keep
 * their own local state instead of (or alongside) the shared Postgres
 * cluster — e.g. TwoDB's control-plane bootstrap store.
 */
export function createSqliteDb<DB>(options: SqliteDbOptions): Kysely<DB> {
  const dir = path.dirname(options.file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(options.file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return new Kysely<DB>({
    dialect: new SqliteDialect({ database: sqlite }),
  });
}

/**
 * Runs every `.sql` file in a migrations directory, in filename order,
 * tracked in a `_migrations` table in the current search_path/schema.
 * Deliberately simple (no up/down, no rollback) — matches the "few moving
 * parts" principle. Good enough for app-local schema evolution; TwoDB's own
 * provisioning migrations (cross-schema) are handled separately in TwoDB.
 */
export async function runSqlMigrations(
  db: Kysely<any>,
  migrationsDir: string,
): Promise<{ applied: string[] }> {
  await db.schema
    .createTable("_migrations")
    .ifNotExists()
    .addColumn("name", "text", (c) => c.primaryKey())
    .addColumn("applied_at", "text", (c) => c.defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  const files = (await fsp.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const already = new Set(
    (await db.selectFrom("_migrations" as any).select("name" as any).execute()).map(
      (r: any) => r.name,
    ),
  );

  const applied: string[] = [];
  for (const file of files) {
    if (already.has(file)) continue;
    const sqlText = await fsp.readFile(path.join(migrationsDir, file), "utf8");
    await db.transaction().execute(async (trx) => {
      for (const stmt of splitStatements(sqlText)) {
        await sql.raw(stmt).execute(trx);
      }
      await trx
        .insertInto("_migrations" as any)
        .values({ name: file } as any)
        .execute();
    });
    applied.push(file);
  }

  return { applied };
}

function splitStatements(text: string): string[] {
  return text
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type { Generated };
export { Kysely } from "kysely";
export { sql } from "kysely";
