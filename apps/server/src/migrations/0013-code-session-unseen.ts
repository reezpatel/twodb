import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** Sidebar "completed but not seen" marker — set when a run ends, cleared when the session is opened. */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("code_session").addColumn("unseenUpdates", "boolean", (c) => c.defaultTo(false).notNull()).execute();
};
