import type { Kysely } from "kysely";

/**
 * Per-app CLI contract cache (cli.json), served at
 * /registry/apps/:slug/cli.json for the twodb CLI. Mirrors manifest_json's
 * lifecycle: self-reported at registration, empty string until then.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("registered_app").addColumn("cli_json", "text", (c) => c.notNull().defaultTo("")).execute();
}
