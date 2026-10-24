import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** Notes databases can be owned by an app feature (e.g. "shared_content").
 *  A locked database's schema (property definitions) cannot be changed by
 *  the user — rows, views, title and placement stay editable. */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("note_node").addColumn("schemaLockedBy", "text").execute();
};
