import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("note_node")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull().references("organization.id").onDelete("cascade"))
    .addColumn("parentId", "text", (c) => c.references("note_node.id").onDelete("cascade"))
    .addColumn("kind", "text", (c) => c.notNull()) // section | folder | notes | checklist | table | sheet | canvas
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("position", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("isFavorite", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("metadata", "jsonb")
    .addColumn("createdAt", "timestamp", (c) => c.notNull())
    .addColumn("updatedAt", "timestamp", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("note_node_org_parent_idx").on("note_node").columns(["organizationId", "parentId"]).execute();

  await db.schema
    .createTable("note_item")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("nodeId", "text", (c) => c.notNull().references("note_node.id").onDelete("cascade"))
    .addColumn("title", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("content", "jsonb", (c) => c.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("preview", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("createdAt", "timestamp", (c) => c.notNull())
    .addColumn("updatedAt", "timestamp", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("note_item_node_idx").on("note_item").column("nodeId").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("note_item").execute();
  await db.schema.dropTable("note_node").execute();
}
