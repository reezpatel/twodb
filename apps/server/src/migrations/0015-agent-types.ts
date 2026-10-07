import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/**
 * Agents get a type + tool allowlist; code sessions get a locked flag for
 * read-only threads (e.g. closed /btw side threads).
 *
 * agent.type: sub_agent | persona | collaborator | sentinel.
 * agent.tools: jsonb array of tool names; ["all"] = every tool (incl. future
 * ones); [] = no tools.
 * code_session.locked: true → the thread is read-only.
 */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("agent").addColumn("type", sql`text`, (c) => c.defaultTo("sub_agent").notNull()).execute();
  await db.schema.alterTable("agent").addColumn("tools", sql`jsonb`, (c) => c.defaultTo(sql`'[]'::jsonb`).notNull()).execute();

  await db.schema.alterTable("code_session").addColumn("locked", sql`boolean`, (c) => c.defaultTo(false).notNull()).execute();
};