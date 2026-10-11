import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/**
 * skill.aiVisible: false → the skill is hidden from the AI entirely —
 * excluded from the system prompt's [Skills] list and from read_skill
 * resolution. It can only be used by the user via /<name> expansion in the
 * chat composer. Defaults to true (existing behavior).
 */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("skill").addColumn("aiVisible", sql`boolean`, (c) => c.defaultTo(true).notNull()).execute();
};