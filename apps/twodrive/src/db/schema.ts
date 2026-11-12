import { sql, type Kysely } from "@twodb/core-data/db";

// ---------------------------------------------------------------------------
// TwoDrive schema — one Postgres schema per app (see AGENTS.md). The central
// `drive_entry` table IS the source of truth for the file tree: every write
// goes through TwoDrive and updates both the entry table and the backend.

export interface BackendRow {
  id: string;
  workspace_id: string;
  name: string;
  /** "s3" | "local" */
  type: string;
  /** JSON blob: s3 → {endpoint, region, bucket, accessKeyId, secretAccessKey(encrypted), forcePathStyle}
   *  local → {rootPath} */
  config: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface VirtualStorageRow {
  id: string;
  workspace_id: string;
  backend_id: string;
  name: string;
  /** Prefix inside the backend where this virtual storage lives ("/"-joined, no leading slash). */
  prefix: string;
  created_at: string;
  updated_at: string;
}

export interface EntryRow {
  id: string;
  workspace_id: string;
  virtual_storage_id: string;
  /** Path relative to the virtual storage root, "/"-joined, no leading/trailing slash. Root not stored. */
  path: string;
  /** "file" | "folder" */
  type: string;
  size: bigint;
  mime_type: string | null;
  /** "image" | "video" | "audio" | "pdf" | "text" | "archive" | "other" */
  preview_type: string | null;
  /** For files: last content etag/hash (backend etag or content sha256). */
  etag: string | null;
  /** Set when the entry is moved to trash (soft delete). */
  deleted_at: string | null;
  /** Original path before it was trashed (for restore). */
  original_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppOverrideRow {
  id: string;
  workspace_id: string;
  /** Friendly app identifier (from the x-twodb-app header), e.g. "twomail". */
  app_id: string;
  virtual_storage_id: string;
  created_at: string;
  updated_at: string;
}

export interface AccessKeyRow {
  id: string;
  workspace_id: string;
  virtual_storage_id: string;
  /** Public access key id shown to the user / sent by clients. */
  access_key_id: string;
  /** sha256 of the secret — never stored or returned in plaintext. */
  secret_hash: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

export interface ShareLinkRow {
  id: string;
  workspace_id: string;
  virtual_storage_id: string;
  entry_id: string;
  /** ULID used in the public URL. */
  token: string;
  expires_at: string | null;
  created_at: string;
}

export interface TwoDriveDb {
  drive_backend: BackendRow;
  drive_virtual_storage: VirtualStorageRow;
  drive_entry: EntryRow;
  drive_app_override: AppOverrideRow;
  drive_access_key: AccessKeyRow;
  drive_share_link: ShareLinkRow;
}

export async function applySchema(db: Kysely<TwoDriveDb>): Promise<void> {
  // TwoDB's provisioner normally creates the schema; self-heal anyway so a
  // bare dev database works too. The least-privilege app role can't create
  // schemas (by design) — that failure is fine, the tables below will
  // still be created inside the existing schema.
  await sql`create schema if not exists twodrive`.execute(db).catch(() => undefined);

  await db.schema
    .createTable("drive_backend")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("config", "text", (c) => c.notNull())
    .addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("drive_backend_workspace_name_idx")
    .ifNotExists()
    .on("drive_backend")
    .columns(["workspace_id", "name"])
    .unique()
    .execute();

  await db.schema
    .createTable("drive_virtual_storage")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("backend_id", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("prefix", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("drive_virtual_storage_workspace_backend_idx")
    .ifNotExists()
    .on("drive_virtual_storage")
    .columns(["workspace_id", "backend_id"])
    .execute();

  await db.schema
    .createIndex("drive_virtual_storage_workspace_name_idx")
    .ifNotExists()
    .on("drive_virtual_storage")
    .columns(["workspace_id", "name"])
    .unique()
    .execute();

  // Central file table — unique per (virtual_storage, path) including trashed
  // entries, so a trashed file and a live file at the same path can coexist.
  await db.schema
    .createTable("drive_entry")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("virtual_storage_id", "text", (c) => c.notNull())
    .addColumn("path", "text", (c) => c.notNull())
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("size", "bigint", (c) => c.notNull().defaultTo(0))
    .addColumn("mime_type", "text")
    .addColumn("preview_type", "text")
    .addColumn("etag", "text")
    .addColumn("deleted_at", "timestamptz")
    .addColumn("original_path", "text")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("drive_entry_vs_path_idx")
    .ifNotExists()
    .on("drive_entry")
    .columns(["virtual_storage_id", "path"])
    .unique()
    .execute();

  await db.schema
    .createIndex("drive_entry_vs_deleted_updated_idx")
    .ifNotExists()
    .on("drive_entry")
    .columns(["virtual_storage_id", "deleted_at", "updated_at"])
    .execute();

  await db.schema
    .createTable("drive_app_override")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("app_id", "text", (c) => c.notNull())
    .addColumn("virtual_storage_id", "text", (c) => c.notNull())
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("drive_app_override_workspace_app_idx")
    .ifNotExists()
    .on("drive_app_override")
    .columns(["workspace_id", "app_id"])
    .unique()
    .execute();

  await db.schema
    .createTable("drive_access_key")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("virtual_storage_id", "text", (c) => c.notNull())
    .addColumn("access_key_id", "text", (c) => c.notNull())
    .addColumn("secret_hash", "text", (c) => c.notNull())
    .addColumn("label", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("last_used_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("drive_access_key_vs_idx")
    .ifNotExists()
    .on("drive_access_key")
    .columns(["virtual_storage_id"])
    .execute();

  await db.schema
    .createIndex("drive_access_key_key_idx")
    .ifNotExists()
    .on("drive_access_key")
    .columns(["access_key_id"])
    .unique()
    .execute();

  await db.schema
    .createTable("drive_share_link")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspace_id", "text", (c) => c.notNull())
    .addColumn("virtual_storage_id", "text", (c) => c.notNull())
    .addColumn("entry_id", "text", (c) => c.notNull())
    .addColumn("token", "text", (c) => c.notNull())
    .addColumn("expires_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("drive_share_link_token_idx")
    .ifNotExists()
    .on("drive_share_link")
    .columns(["token"])
    .unique()
    .execute();
}
