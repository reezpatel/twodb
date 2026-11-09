import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** code_session.archivedAt — null = active; set = archived (hidden from the
 * sidenav unless archive mode is on; never deleted). */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("code_session").addColumn("archivedAt", "timestamptz").execute();
};
