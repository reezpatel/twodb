import { sql, type Kysely } from "kysely";
import { Migrator } from "kysely/migration";
import { dbSchema, type Database } from "../plugins/db";
import { migrations } from "../migrations";

const BASELINE_MIGRATION = "0001_initial";

async function tableExists(db: Kysely<Database>, table: string): Promise<boolean> {
  const result = await sql<{ exists: boolean }>`
    select exists (
      select 1 from information_schema.tables
      where table_schema = ${dbSchema} and table_name = ${table}
    ) as "exists"`.execute(db);
  return result.rows[0]?.exists === true;
}

// Databases created before migrations were reintroduced already carry the full
// schema from the old self-bootstrapping DDL — record the baseline migration
// as applied so it isn't re-run against existing tables.
async function seedBaselineIfNeeded(db: Kysely<Database>): Promise<void> {
  if (!(await tableExists(db, "user"))) return;

  const migrationTable = sql.id(dbSchema, "kysely_migration");
  if (await tableExists(db, "kysely_migration")) {
    const applied = await sql<{ n: number }>`
      select count(*)::int as n from ${migrationTable}
      where name = ${BASELINE_MIGRATION}`.execute(db);
    if ((applied.rows[0]?.n ?? 0) > 0) return;
  } else {
    await sql`
      create table ${migrationTable} (
        name varchar(255) primary key,
        "timestamp" varchar(255) not null
      )`.execute(db);
  }

  await sql`
    insert into ${migrationTable} (name, "timestamp")
    values (${BASELINE_MIGRATION}, ${new Date().toISOString()})
    on conflict do nothing`.execute(db);
  console.log(`migrations: existing database — marked ${BASELINE_MIGRATION} as applied`);
}

export async function runMigrations(db: Kysely<Database>): Promise<void> {
  await sql`create schema if not exists ${sql.id(dbSchema)}`.execute(db);
  await seedBaselineIfNeeded(db);

  const migrator = new Migrator({
    db,
    migrationTableSchema: dbSchema,
    provider: { getMigrations: async () => migrations },
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === "Success") {
      console.log(`migrations: ✓ ${result.migrationName}`);
    } else if (result.status === "Error") {
      console.error(`migrations: ✗ ${result.migrationName}`);
    }
  }

  if (error) throw error;
}
