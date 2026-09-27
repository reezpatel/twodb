import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("workspace")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("workspace_organization_idx").on("workspace").column("organizationId").execute();

  await db.schema
    .createTable("skill")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspaceId", "text", (c) => c.notNull().references("workspace.id").onDelete("cascade"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("skill_workspace_name_unique", ["workspaceId", "name"])
    .execute();

  await db.schema
    .createTable("mode")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspaceId", "text", (c) => c.notNull().references("workspace.id").onDelete("cascade"))
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("instruction", "text", (c) => c.notNull())
    .addColumn("commands", "jsonb", (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("mode_workspace_type_unique", ["workspaceId", "type"])
    .execute();

  await db.schema
    .createTable("memory")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspaceId", "text", (c) => c.notNull().references("workspace.id").onDelete("cascade"))
    .addColumn("scopeId", "text")
    .addColumn("tags", sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("memory_workspace_idx").on("memory").column("workspaceId").execute();

  await db.schema
    .alterTable("code_session")
    .addColumn("type", "text", (c) => c.notNull().defaultTo("main_agent"))
    .execute();
  await db.schema
    .alterTable("code_session")
    .addColumn("parentSessionId", "text", (c) => c.references("code_session.id").onDelete("cascade"))
    .execute();
  await db.schema
    .alterTable("code_session")
    .addColumn("workspaceId", "text", (c) => c.references("workspace.id").onDelete("set null"))
    .execute();
  await db.schema.alterTable("code_session").addColumn("currentMode", "text").execute();

  await db.schema.createIndex("code_session_workspace_idx").on("code_session").column("workspaceId").execute();
  await db.schema.createIndex("code_session_parent_idx").on("code_session").column("parentSessionId").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("code_session").dropColumn("currentMode").execute();
  await db.schema.alterTable("code_session").dropColumn("workspaceId").execute();
  await db.schema.alterTable("code_session").dropColumn("parentSessionId").execute();
  await db.schema.alterTable("code_session").dropColumn("type").execute();

  await db.schema.dropTable("memory").execute();
  await db.schema.dropTable("mode").execute();
  await db.schema.dropTable("skill").execute();
  await db.schema.dropTable("workspace").execute();
}
