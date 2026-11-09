import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** Memories: tags out, scope (workspace | project | session) in. */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("memory").dropColumn("tags").execute();
  await db.schema
    .alterTable("memory")
    .addColumn("scope", "text", (c) => c.defaultTo("workspace").notNull())
    .execute();
};
