import { sql } from "kysely";
import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** The shared-content `medias` column becomes a real `media` property type
 *  (text[] of media ids) instead of `text` holding a JSON.stringify'd array
 *  of StoredMediaDescriptor objects. Existing locked databases get their
 *  schema column retyped and the physical column converted, extracting each
 *  descriptor's mediaId (plain strings are kept as one-element arrays). */
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
    const column = schema.columns.find((c) => c.id === "medias");
    if (!column || column.type === "media") continue;

    await db
      .updateTable("note_node")
      .set({ schema: { ...schema, columns: schema.columns.map((c) => (c.id === "medias" ? { ...c, type: "media" } : c)) } })
      .where("id", "=", database.id)
      .execute();

    const table = `notes_${database.id.replace(/[^a-zA-Z0-9]/g, "")}`;
    await sql`
      ALTER TABLE ${sql.raw(`"${table}"`)} ALTER COLUMN "medias" TYPE text[] USING (
        CASE
          WHEN "medias" IS NULL OR btrim("medias") = '' THEN NULL
          WHEN btrim("medias") LIKE '[%' THEN (
            SELECT array_agg(e ->> 'mediaId')
            FROM jsonb_array_elements("medias"::jsonb) AS e
            WHERE e ->> 'mediaId' IS NOT NULL
          )
          ELSE ARRAY["medias"]
        END
      )
    `.execute(db);
  }
};
