import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { Kysely, PostgresDialect, WithSchemaPlugin } from "kysely";
import { Migrator, type Migration } from "kysely/migration";
import type { Pool } from "pg";

declare module "fastify" {
	interface FastifyInstance {
		db: Kysely<unknown>;
	}
}

export const dbPlugin = fp(
	async (fastify: FastifyInstance) => {
		const pool = (fastify as unknown as { pg: { pool: Pool } }).pg.pool;
		const db = new Kysely<unknown>({
			dialect: new PostgresDialect({ pool }),
		});
		fastify.decorate("db", db);
	},
	{ name: "twodb-db", dependencies: ["twodb-postgres"] },
);

export function typedDb<DB>(fastify: FastifyInstance): Kysely<DB> {
	return fastify.db as unknown as Kysely<DB>;
}

/** Postgres schema owned by a plugin: `io.twodb.identity` -> `io_twodb_identity`. */
export function pluginSchemaName(pluginId: string): string {
	return pluginId.replaceAll(".", "_");
}

/** db handle that resolves every unqualified table into the plugin's schema. */
export function scopedDb<DB>(
	fastify: FastifyInstance,
	pluginId: string,
): Kysely<DB> {
	return typedDb<DB>(fastify).withPlugin(
		new WithSchemaPlugin(pluginSchemaName(pluginId)),
	);
}

export async function runPluginMigrations<DB>(
	db: Kysely<DB>,
	pluginId: string,
	migrations: Record<string, Migration>,
): Promise<void> {
	const migrator = new Migrator({
		db,
		migrationTableName: "kysely_migration",
		migrationTableSchema: pluginSchemaName(pluginId),
		provider: { getMigrations: async () => migrations },
	});
	const { error, results } = await migrator.migrateToLatest();
	if (error) throw error;
	for (const result of results ?? []) {
		if (result.status === "Error") {
			throw new Error(`migration ${result.migrationName} failed`);
		}
	}
}
