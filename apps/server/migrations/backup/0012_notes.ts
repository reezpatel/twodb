import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("note_section")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("organizationId", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("note_folder")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("organizationId", "text", (col) => col.notNull())
    .addColumn("sectionId", "text", (col) => col.notNull())
    .addColumn("parentId", "text")
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("note_group")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("organizationId", "text", (col) => col.notNull())
    .addColumn("folderId", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull().defaultTo("notes"))
    .addColumn("position", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("isFavorite", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("note_group").execute();
  await db.schema.dropTable("note_folder").execute();
  await db.schema.dropTable("note_section").execute();
}
