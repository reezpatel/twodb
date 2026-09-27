import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("code_directory")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("runnerId", "text", (c) => c.notNull())
    .addColumn("cwd", "text", (c) => c.notNull())
    .addColumn("displayName", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("code_directory_organization_idx").on("code_directory").column("organizationId").execute();

  await db.schema
    .createTable("skill")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("codeDirectoryId", "text", (c) => c.references("code_directory.id").onDelete("cascade"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("skill_scope_name_unique", ["organizationId", "codeDirectoryId", "name"], (uc) => uc.nullsNotDistinct())
    .execute();

  await db.schema
    .createTable("agent")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("codeDirectoryId", "text", (c) => c.references("code_directory.id").onDelete("cascade"))
    .addColumn("provider", "text", (c) => c.notNull())
    .addColumn("model", "text", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("instruction", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("agent_organization_idx").on("agent").column("organizationId").execute();

  await db.schema
    .createTable("instruction")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("codeDirectoryId", "text", (c) => c.references("code_directory.id").onDelete("cascade"))
    .addColumn("instruction", "text", (c) => c.notNull())
    .addColumn("instructionPath", "text", (c) => c.notNull())
    .addColumn("hash", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("instruction_scope_path_unique", ["organizationId", "codeDirectoryId", "instructionPath"], (uc) => uc.nullsNotDistinct())
    .execute();

  await db.schema.createIndex("instruction_organization_idx").on("instruction").column("organizationId").execute();

  await db.schema
    .createTable("memory")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("codeDirectoryId", "text", (c) => c.references("code_directory.id").onDelete("cascade"))
    .addColumn("scopeId", "text")
    .addColumn("tags", sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("memory_organization_idx").on("memory").column("organizationId").execute();

  await db.schema
    .createTable("code_session")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("connectionId", "text")
    .addColumn("model", "text")
    .addColumn("codeDirectoryId", "text", (c) => c.references("code_directory.id").onDelete("set null"))
    .addColumn("type", "text", (c) => c.notNull().defaultTo("main_agent"))
    .addColumn("parentSessionId", "text", (c) => c.references("code_session.id").onDelete("cascade"))
    .addColumn("agentId", "text", (c) => c.references("agent.id").onDelete("set null"))
    .addColumn("mode", "jsonb")
    .addColumn("runtimeState", "jsonb")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("code_session_organization_idx").on("code_session").column("organizationId").execute();
  await db.schema.createIndex("code_session_directory_idx").on("code_session").column("codeDirectoryId").execute();
  await db.schema.createIndex("code_session_parent_idx").on("code_session").column("parentSessionId").execute();
  await db.schema.createIndex("code_session_agent_idx").on("code_session").column("agentId").execute();

  await db.schema
    .createTable("code_session_message")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("sessionId", "text", (c) => c.notNull().references("code_session.id").onDelete("cascade"))
    .addColumn("role", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("meta", "jsonb")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("code_session_message_session_idx").on("code_session_message").column("sessionId").execute();

  await db.schema
    .createTable("code_session_usage_event")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("sessionId", "text", (c) => c.notNull().references("code_session.id").onDelete("cascade"))
    .addColumn("connectionId", "text", (c) => c.notNull().references("llm_connection.id").onDelete("cascade"))
    .addColumn("model", "text", (c) => c.notNull())
    .addColumn("inputTokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("outputTokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("cachedInputTokens", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("code_session_usage_event_session_idx").on("code_session_usage_event").column("sessionId").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("code_session_usage_event").execute();
  await db.schema.dropTable("code_session_message").execute();
  await db.schema.dropTable("code_session").execute();
  await db.schema.dropTable("memory").execute();
  await db.schema.dropTable("instruction").execute();
  await db.schema.dropTable("agent").execute();
  await db.schema.dropTable("skill").execute();
  await db.schema.dropTable("code_directory").execute();
}
