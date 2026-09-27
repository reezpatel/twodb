import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("llm_connection")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("provider", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("config", "jsonb", (c) => c.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("llm_connection_organization_idx").on("llm_connection").column("organizationId").execute();

  await db.schema
    .createTable("llm_model")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("connectionId", "text", (c) => c.notNull().references("llm_connection.id").onDelete("cascade"))
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("modelId", "text", (c) => c.notNull())
    .addColumn("displayName", "text")
    .addColumn("contextWindow", "integer")
    .addColumn("thinking", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("input", sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'::text[]`)) // text | image | video
    .addColumn("thinkingLevel", sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("llm_model_connection_idx").on("llm_model").column("connectionId").execute();

  await db.schema
    .createTable("llm_usage_event")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("connectionId", "text", (c) => c.notNull().references("llm_connection.id").onDelete("cascade"))
    .addColumn("correlationId", "text") // e.g. assistant thread or code session id
    .addColumn("model", "text", (c) => c.notNull())
    .addColumn("inputTokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("outputTokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("cachedInputTokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("llm_usage_event_connection_idx").on("llm_usage_event").column("connectionId").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("llm_usage_event").execute();
  await db.schema.dropTable("llm_model").execute();
  await db.schema.dropTable("llm_connection").execute();
}
