import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/**
 * agent.workDirectoryId: where a persona's sessions run. Distinct from
 * agent.codeDirectoryId, which only scopes where the agent is visible.
 * null = inherit the invoking session's directory.
 */
export const up: Migration["up"] = async () => {
  await db.schema
    .alterTable("agent")
    .addColumn("workDirectoryId", sql`text`, (c) => c.references("code_directory.id").onDelete("set null"))
    .execute();
};
