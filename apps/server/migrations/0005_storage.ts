import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("storage_backend")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull().unique())
    .addColumn("type", "text", (col) => col.notNull()) // 'object' | 'block'
    .addColumn("config", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("storage_bucket")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("organizationId", "text", (col) => col.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("backendId", "text", (col) => col.notNull().references("storage_backend.id").onDelete("cascade"))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull().defaultTo("default"))
    .addColumn("isInternal", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("storageLimit", "bigint") // bytes; null = unlimited
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .addUniqueConstraint("storage_bucket_org_name_unique", ["organizationId", "name"])
    .execute();

  await db.schema.createIndex("storage_bucket_org_idx").on("storage_bucket").columns(["organizationId", "backendId"]).execute();

  await db.schema
    .createTable("storage_entry")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("organizationId", "text", (col) => col.notNull())
    .addColumn("bucketId", "text", (col) => col.notNull().references("storage_bucket.id").onDelete("cascade"))
    .addColumn("path", "text", (col) => col.notNull()) // bucket-org-root-relative, no leading/trailing slash
    .addColumn("type", "text", (col) => col.notNull()) // 'file' | 'folder'
    .addColumn("size", "bigint", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("mimeType", "text")
    .addColumn("previewType", "text") // image | video | audio | pdf | text | archive | other
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .addUniqueConstraint("storage_entry_bucket_path_unique", ["bucketId", "path"])
    .execute();

  await db.schema.createIndex("storage_entry_bucket_idx").on("storage_entry").columns(["organizationId", "bucketId"]).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("storage_entry").execute();
  await db.schema.dropTable("storage_bucket").execute();
  await db.schema.dropTable("storage_backend").execute();
}
