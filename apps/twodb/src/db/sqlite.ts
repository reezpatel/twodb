import { createSqliteDb, Kysely, sql } from "@twodb/core-data/db";
import { applyAuthPlatformSchema, type AuthPlatformDb } from "@twodb/core-platform/auth";

export interface RegisteredAppRow {
  slug: string;
  name: string;
  version: string;
  shape: string;
  base_path: string;
  http_url: string;
  socket_path: string | null;
  host_id: string;
  capabilities: string; // JSON string[]
  manifest_json: string; // the app's full endpoint.json, cached
  pg_schema: string | null;
  pg_role: string | null;
  pg_password_encrypted: string | null;
  registered_at: string;
  last_seen_at: string | null;
  status: string; // "active" | "unreachable"
}

export interface ControlPlaneDb extends AuthPlatformDb {
  registered_app: RegisteredAppRow;
}

export function openControlPlaneDb(file: string): Kysely<ControlPlaneDb> {
  return createSqliteDb<ControlPlaneDb>({ file });
}

/** Idempotent — safe to call on every boot. Creates every control-plane table TwoDB owns. */
export async function bootstrapControlPlaneDb(db: Kysely<ControlPlaneDb>): Promise<void> {
  await applyAuthPlatformSchema(db as any);

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
    .addColumn("manifest_json", "text", (c) => c.notNull())
    .addColumn("pg_schema", "text")
    .addColumn("pg_role", "text")
    .addColumn("pg_password_encrypted", "text")
    .addColumn("registered_at", "text", (c) => c.notNull())
    .addColumn("last_seen_at", "text")
    .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
    .execute();
}

export { sql };
