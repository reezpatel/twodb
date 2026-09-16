// SQLite Fastify plugin.
//
// Powers the admin api: a single-file database owned by the api itself,
// stored at `$TWO_DB_WORK_DIR/db-v1.sqlite`. better-sqlite3 (sync driver)
// owns the file; Kysely sits on top as the query layer the rest of the api
// uses through `fastify.sqlite.db`.
//
// Migrations are owned by the api: Kysely modules in `src/db/migrations/`,
// registered in order in `migrations/index.ts`, applied exactly once
// (tracked in the `schema_migrations` table), each inside its own
// transaction. Adding a table = appending a migration module - there is no
// external migration tool.
//
// Adds to fastify:
//   fastify.sqlite.db                 - Kysely<Database> query builder (typed
//                                       against src/db/schema.ts)
//   fastify.sqlite.raw                - the underlying better-sqlite3 Database
//   fastify.sqlite.filePath           - absolute path of the database file
//   fastify.sqlite.appliedMigrations  - names of migrations applied at boot
//   fastify.sqlite.ping()             - connectivity probe (/health/ready)
//
// Config (from fastify.config, populated by fastify-env):
//   TWO_DB_WORK_DIR - directory holding db-v1.sqlite (created if missing).
//   Relative paths resolve from apps/api/src, matching STATIC_DIR.
// Plugin options override config when provided (useful for tests).

import fs from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { Kysely, SqliteDialect, sql } from "kysely";
import { migrations } from "./migrations/index";
import type { Database } from "./schema";

const DATABASE_FILE = "db-v1.sqlite";

interface SqlitePluginOptions {
	workDir?: string;
	fileName?: string;
}

/**
 * Apply every pending migration in registration order, each inside its own
 * transaction. Tracks applied names in `schema_migrations`.
 * Returns names of all applied migrations (old + new).
 */
async function runMigrations(db: Kysely<Database>): Promise<string[]> {
	await db.schema
		.createTable("schema_migrations")
		.ifNotExists()
		.addColumn("name", "text", (c) => c.primaryKey())
		.addColumn("applied_at", "text", (c) =>
			c.notNull().defaultTo(sql`(datetime('now'))`),
		)
		.execute();

	const applied = new Set(
		(
			await db
				.selectFrom("schema_migrations")
				.select("name")
				.orderBy("name")
				.execute()
		).map((row) => row.name),
	);

	for (const migration of migrations) {
		if (applied.has(migration.name)) continue;
		await db.transaction().execute(async (trx) => {
			await migration.up(trx);
			await trx
				.insertInto("schema_migrations")
				.values({ name: migration.name })
				.execute();
		});
	}

	return migrations.map((migration) => migration.name);
}

const sqlitePlugin: FastifyPluginAsync<SqlitePluginOptions> = async (
	fastify,
	opts,
) => {
	const cfg = fastify.config ?? {};
	// Resolve relative work dirs from apps/api/src (this file lives in
	// src/db/), matching how static.ts resolves STATIC_DIR.
	const srcDir = path.resolve(import.meta.dirname, "..");
	const workDir = path.resolve(
		srcDir,
		opts?.workDir ?? cfg.TWO_DB_WORK_DIR ?? "../../../.work",
	);
	const fileName = opts?.fileName ?? DATABASE_FILE;
	const filePath = path.join(workDir, fileName);

	fs.mkdirSync(workDir, { recursive: true });

	const raw = new BetterSqlite3(filePath);
	raw.pragma("journal_mode = WAL");
	raw.pragma("foreign_keys = ON");

	const db = new Kysely<Database>({
		dialect: new SqliteDialect({ database: raw }),
	});

	const appliedMigrations = await runMigrations(db);
	fastify.log.info(
		{ filePath, migrations: appliedMigrations.length },
		"sqlite database ready",
	);

	fastify.addHook("onClose", async () => {
		await db.destroy();
		fastify.log.info("sqlite database closed");
	});

	fastify.decorate("sqlite", {
		db,
		raw,
		filePath,
		appliedMigrations,
		ping: async () => {
			raw.prepare("SELECT 1").get();
		},
	});
};

export default fp(sqlitePlugin, {
	name: "twodb-sqlite",
});
