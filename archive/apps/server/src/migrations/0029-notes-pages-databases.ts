import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/** Notion-style notes: one node table for sections, pages and databases.
 *
 *  - kind: 'section' | 'page' | 'database'
 *  - database rows are `page` nodes whose parent is the database; their
 *    dynamic property values live in notes_<databaseId> (keyed by nodeId)
 *  - pages carry their tiptap doc in `content`; databases carry columns/views
 *    in `schema`
 *  - nothing is hard-deleted from the UI: `deletedAt` soft-deletes
 *
 *  Existing notes data is wiped (sections/folders/groups/items and every
 *  notes_* property table) — agreed with the user; the old model doesn't map.
 */
export const up: Migration["up"] = async () => {
  const dynTables = await sql<{ tablename: string }>`
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename LIKE 'notes\\_%'
  `.execute(db);
  for (const { tablename } of dynTables.rows) {
    await sql`DROP TABLE IF EXISTS ${sql.raw(`"${tablename.replace(/"/g, "")}"`)} CASCADE`.execute(db);
  }
  await db.schema.dropTable("note_item").ifExists().cascade().execute();
  await db.schema.dropTable("note_node").ifExists().cascade().execute();

  await db.schema
    .createTable("note_node")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("parentId", "text")
    .addColumn("kind", "text", (c) => c.notNull())
    .addColumn("title", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("icon", "text")
    .addColumn("cover", "text")
    .addColumn("content", "jsonb")
    .addColumn("preview", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("schema", "jsonb")
    .addColumn("inline", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("position", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("isFavorite", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("deletedAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addCheckConstraint("note_node_kind_check", sql`kind IN ('section', 'page', 'database')`)
    .execute();

  await db.schema.createIndex("note_node_org_parent_idx").on("note_node").columns(["organizationId", "parentId"]).execute();
  await db.schema.createIndex("note_node_org_kind_idx").on("note_node").columns(["organizationId", "kind"]).execute();
};
