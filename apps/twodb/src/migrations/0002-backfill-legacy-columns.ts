import { sql, type Kysely } from "kysely";

/**
 * Databases created before migrations existed were bootstrapped by the old
 * self-creating DDL in db/sqlite.ts, which drifted over time (e.g. the
 * `managed` column was added late). 0001 is a no-op for them, so this
 * migration inspects the live table and ALTERs in every column of the
 * current schema that's missing. Idempotent by construction: the column
 * list is checked against `pragma table_info` before each ALTER.
 */

// name → column DDL, mirroring 0001-initial.ts exactly (minus createTable).
const LEGACY_COLUMNS: Record<string, string> = {
  socket_path: "text",
  host_id: "text not null default ''",
  capabilities: "text not null default '[]'",
  manifest_json: "text not null default ''",
  pg_schema: "text",
  pg_role: "text",
  pg_connection_string_encrypted: "text",
  data_key_encrypted: "text",
  registration_token_hash: "text",
  image_tag: "text",
  container_name: "text",
  host_port: "integer",
  install_status: "text not null default 'not_installed'",
  managed: "integer not null default 1",
  installed_at: "text",
  registered_at: "text",
  last_seen_at: "text",
  status: "text not null default 'unknown'",
};

export async function up(db: Kysely<unknown>): Promise<void> {
  const exists = await sql<{ name: string }>`pragma table_info('registered_app')`.execute(db);
  const present = new Set(exists.rows.map((r) => r.name));

  for (const [name, ddl] of Object.entries(LEGACY_COLUMNS)) {
    if (present.has(name)) continue;
    await sql.raw(`alter table registered_app add column ${name} ${ddl}`).execute(db);
  }
}
