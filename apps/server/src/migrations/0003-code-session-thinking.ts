import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** Adds the per-session thinking level (off/low/medium/high; null = medium). */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("code_session").addColumn("thinkingLevel", "text").execute();
};
