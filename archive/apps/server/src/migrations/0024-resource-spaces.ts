import type { Migration } from "kysely/migration";
import { db } from "../auth";

/**
 * Optional space on org resources. null = all spaces (the default). A resource
 * with a space matches only sessions/clients in the same space; a session in
 * an unspaced directory (code_directory.spaceId = null) sees only null-space
 * resources.
 */
const TABLES = ["llm_connection", "skill", "agent", "memory", "instruction", "mcp_server", "code_directory"];

export const up: Migration["up"] = async () => {
  for (const table of TABLES) {
    await db.schema.alterTable(table).addColumn("spaceId", "text").execute();
    await db.schema
      .alterTable(table)
      .addForeignKeyConstraint(`${table}_spaceId_fkey`, ["spaceId"], "space", ["id"], (c) => c.onDelete("set null"))
      .execute();
    await db.schema.createIndex(`${table}_space_idx`).on(table).columns(["spaceId"]).execute();
  }
};