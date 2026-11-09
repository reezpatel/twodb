import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** The shared-content `status` column becomes a `select` property instead of
 *  `status`. Both map to a physical `text` column, so only the locked schema
 *  JSON needs updating on existing databases (option `group` labels, a
 *  status-only feature, are dropped). */
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
    const column = schema.columns.find((c) => c.id === "status");
    if (!column || column.type === "select") continue;
    await db
      .updateTable("note_node")
      .set({
        schema: {
          ...schema,
          columns: schema.columns.map((c) =>
            c.id === "status" ? { ...c, type: "select", options: c.options?.map(({ group: _group, ...o }) => o) } : c,
          ),
        },
      })
      .where("id", "=", database.id)
      .execute();
  }
};
