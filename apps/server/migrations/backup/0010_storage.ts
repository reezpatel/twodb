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
    .createTable("storage_entry")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("organizationId", "text", (col) => col.notNull())
    .addColumn("backendId", "text", (col) => col.notNull())
    .addColumn("path", "text", (col) => col.notNull()) // backend-org-root-relative, no leading/trailing slash
    .addColumn("type", "text", (col) => col.notNull()) // 'file' | 'folder'
    .addColumn("size", "bigint", (col) => col.notNull().defaultTo(sql`0`))
    .addColumn("contentType", "text")
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .addUniqueConstraint("storage_entry_unique_path", ["backendId", "organizationId", "path"])
    .execute();

  await db.schema.createIndex("storage_entry_org_idx").on("storage_entry").columns(["organizationId", "backendId", "path"]).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("storage_entry").execute();
  await db.schema.dropTable("storage_backend").execute();
}
