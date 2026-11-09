import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/** MCP servers (Settings → LLM → MCP) whose tools are offered to code-session agents. */
export const up: Migration["up"] = async () => {
  await db.schema
    .createTable("mcp_server")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("codeDirectoryId", "text")
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("url", "text", (c) => c.notNull())
    .addColumn("transport", "text", (c) => c.notNull().defaultTo("auto"))
    .addColumn("headers", sql`jsonb`, (c) => c.defaultTo(sql`'{}'::jsonb`).notNull())
    .addColumn("enabled", "boolean", (c) => c.defaultTo(true).notNull())
    .addColumn("tags", sql`text[]`, (c) => c.defaultTo(sql`'{}'::text[]`).notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("mcp_server_scope_name_unique", ["organizationId", "codeDirectoryId", "name"], (c) => c.nullsNotDistinct())
    .execute();

  await db.schema.createIndex("mcp_server_organization_idx").on("mcp_server").columns(["organizationId"]).execute();
  await db.schema
    .alterTable("mcp_server")
    .addForeignKeyConstraint("mcp_server_codeDirectoryId_fkey", ["codeDirectoryId"], "code_directory", ["id"], (c) => c.onDelete("cascade"))
    .execute();
  await db.schema
    .alterTable("mcp_server")
    .addForeignKeyConstraint("mcp_server_organizationId_fkey", ["organizationId"], "organization", ["id"], (c) => c.onDelete("cascade"))
    .execute();
};
