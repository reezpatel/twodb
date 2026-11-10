import { createSqliteDb, Kysely, sql } from "@twodb/core-data/db";
import { applyAuthPlatformSchema, type AuthPlatformDb } from "@twodb/core-platform/auth";

export type InstallStatus =
  | "not_installed"
  | "installing"
  | "running"
  | "stopped"
  | "failed"
  | "uninstalled"
  /** Unmanaged entry: registered for the gateway, lifecycle owned elsewhere. */
  | "external";

export interface RegisteredAppRow {
  slug: string;
  name: string;
  version: string;
  shape: string;
  base_path: string;
  http_url: string;
  /** 1 = control plane owns lifecycle (install/stop/upgrade); 0 = external entry. */
  managed: number;
  socket_path: string | null;
  host_id: string;
  capabilities: string; // JSON string[]
  manifest_json: string; // the app's full endpoint.json, cached — empty string until the app actually registers
  pg_schema: string | null;
  pg_role: string | null;
  /** Encrypted full Postgres connection string (AES-256-GCM, keyed off AUTH_SECRET) — needed again every container (re)start. */
  pg_connection_string_encrypted: string | null;
  /**
   * Encrypted stable per-app data key (AES-256-GCM, keyed off AUTH_SECRET),
   * injected into the container as TWODB_DATA_KEY. Unlike the registration
   * token this NEVER rotates on upgrade — apps use it for encrypting their
   * own data at rest, so rotating it would orphan existing rows.
   */
  data_key_encrypted: string | null;
  /** Hash (sha256) of the per-install registration token TwoDB generated — never store the plaintext. */
  registration_token_hash: string | null;
  image_tag: string | null;
  container_name: string | null;
  host_port: number | null;
  install_status: InstallStatus;
  installed_at: string | null;
  registered_at: string | null;
  last_seen_at: string | null;
  /** Reachability as last observed by the Gateway proxy / health probe — distinct from install_status (a container can be "running" per Docker but still "unreachable"). */
  status: string;
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

export { sql };
