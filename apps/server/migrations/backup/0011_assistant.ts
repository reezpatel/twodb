import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("assistant_thread")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("organizationId", "text", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("connectionId", "text")
    .addColumn("model", "text")
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("assistant_message")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("threadId", "text", (col) => col.notNull())
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("meta", "jsonb")
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("assistant_artifact")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("threadId", "text", (col) => col.notNull())
    .addColumn("organizationId", "text", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull()) // markdown | html | code | text
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("createdAt", "timestamp", (col) => col.notNull())
    .addColumn("updatedAt", "timestamp", (col) => col.notNull())
    .addUniqueConstraint("assistant_artifact_unique_title", ["threadId", "title"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("assistant_artifact").execute();
  await db.schema.dropTable("assistant_message").execute();
  await db.schema.dropTable("assistant_thread").execute();
}
