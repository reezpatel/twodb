import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("llm_model")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("connectionId", "text", (c) => c.notNull().references("llm_connection.id").onDelete("cascade"))
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("modelId", "text", (c) => c.notNull())
    .addColumn("displayName", "text")
    .addColumn("contextWindow", "integer")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("llm_model_connection_idx").on("llm_model").column("connectionId").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("llm_model").execute();
}
