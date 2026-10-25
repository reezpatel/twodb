import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** The shared-content `url` and `site` columns are `url`-typed. Both map to
 *  a physical `text` column, so only the locked schema JSON needs updating
 *  on existing databases. */
export const up: Migration["up"] = async () => {
  const databases = await db
    .selectFrom("note_node")
    .select(["id", "schema"])
    .where("kind", "=", "database")
    .where("schemaLockedBy", "=", "twodb:shared_content")
    .execute();

  for (const database of databases) {
    const schema = database.schema;
    if (!schema || !Array.isArray(schema.columns)) continue;
    const retype = new Set(["url", "site"]);
    if (!schema.columns.some((c) => retype.has(c.id) && c.type !== "url")) continue;
    await db
      .updateTable("note_node")
      .set({ schema: { ...schema, columns: schema.columns.map((c) => (retype.has(c.id) ? { ...c, type: "url" } : c)) } })
      .where("id", "=", database.id)
      .execute();
  }
};
