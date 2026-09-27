import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("llm_connection").addColumn("runnerId", "text").execute();

  await db.schema
    .createTable("code_session")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("connectionId", "text")
    .addColumn("model", "text")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("code_session_organization_idx").on("code_session").column("organizationId").execute();

  await db.schema
    .createTable("code_session_message")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("sessionId", "text", (c) => c.notNull().references("code_session.id").onDelete("cascade"))
    .addColumn("role", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("code_session_message_session_idx").on("code_session_message").column("sessionId").execute();

  await db.schema
    .createTable("llm_usage_event")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("connectionId", "text", (c) => c.notNull().references("llm_connection.id").onDelete("cascade"))
    .addColumn("sessionId", "text")
    .addColumn("model", "text", (c) => c.notNull())
    .addColumn("inputTokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("outputTokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("llm_usage_event_connection_idx").on("llm_usage_event").column("connectionId").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("llm_usage_event").execute();
  await db.schema.dropTable("code_session_message").execute();
  await db.schema.dropTable("code_session").execute();
  await db.schema.alterTable("llm_connection").dropColumn("runnerId").execute();
}
