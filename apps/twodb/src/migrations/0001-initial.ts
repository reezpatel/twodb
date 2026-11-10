import type { Kysely } from "kysely";

/**
 * Baseline: TwoDB's control-plane `registered_app` table with the full
 * current schema. Mirrors the old self-bootstrapping DDL that lived in
 * db/sqlite.ts — `ifNotExists` makes this a no-op on databases created
 * before migrations were introduced; those get any missing columns from
 * 0002-backfill-legacy-columns.ts instead.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("registered_app")
    .ifNotExists()
    .addColumn("slug", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("version", "text", (c) => c.notNull())
    .addColumn("shape", "text", (c) => c.notNull())
    .addColumn("base_path", "text", (c) => c.notNull())
    .addColumn("http_url", "text", (c) => c.notNull())
    .addColumn("socket_path", "text")
    .addColumn("host_id", "text", (c) => c.notNull())
    .addColumn("capabilities", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("manifest_json", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("pg_schema", "text")
    .addColumn("pg_role", "text")
    .addColumn("pg_connection_string_encrypted", "text")
    .addColumn("data_key_encrypted", "text")
    .addColumn("registration_token_hash", "text")
    .addColumn("image_tag", "text")
    .addColumn("container_name", "text")
    .addColumn("host_port", "integer")
    .addColumn("install_status", "text", (c) => c.notNull().defaultTo("not_installed"))
    .addColumn("managed", "integer", (c) => c.notNull().defaultTo(1))
    .addColumn("installed_at", "text")
    .addColumn("registered_at", "text")
    .addColumn("last_seen_at", "text")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("unknown"))
    .execute();
}
