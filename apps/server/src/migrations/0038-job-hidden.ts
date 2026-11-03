import type { Migration } from "kysely/migration";
import { db } from "../auth";

/**
 * Background jobs can be hidden from the sidebar (after /new or /compact the
 * old ones are stopped and retired) without deleting the row — logs and the
 * transcript's completion messages still reference them.
 */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("code_session_job").addColumn("hiddenAt", "timestamptz").execute();
};
