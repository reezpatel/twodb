import { promises as fs } from "node:fs";
import path from "node:path";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { createDb } from "../src/plugins/db";
import { env } from "../src/env";

const db = createDb(env.databaseUrl);

const migrator = new Migrator({
  db,
  migrationTableSchema: "public",
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(import.meta.dirname, "../migrations"),
  }),
});

const { error, results } = await migrator.migrateToLatest();

for (const result of results ?? []) {
  const status = result.status === "Success" ? "✓" : "✗";
  console.log(`${status} ${result.migrationName} (${result.status})`);
}

await db.destroy();

if (error) {
  console.error("migration failed:", error);
  process.exit(1);
}

console.log("migrations up to date");
