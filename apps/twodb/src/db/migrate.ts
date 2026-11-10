import { Migrator } from "kysely/migration";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { ControlPlaneDb } from "../db/sqlite.js";
import { migrations } from "../migrations/index.js";

/**
 * Runs the control-plane schema migrations with Kysely's Migrator. Ported
 * from the legacy server app's lib/migrate.ts, minus the Postgres
 * schema/baseline-seeding dance: migration 0001 is `createTable
 * ifNotExists`, so it's already a no-op on databases bootstrapped by the
 * old self-creating DDL (and 0002 backfills any drifted columns).
 */
export async function runMigrations(db: Kysely<ControlPlaneDb>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => migrations },
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === "Success") {
      console.log(`[twodb] migration applied: ${result.migrationName}`);
    } else if (result.status === "Error") {
      console.error(`[twodb] migration failed: ${result.migrationName}`, (result as { error?: unknown }).error);
    }
  }

  if (error) throw error;
}
