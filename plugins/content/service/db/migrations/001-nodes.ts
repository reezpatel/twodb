import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { CONTENT_SCHEMA as S } from "..";

export const nodesMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema.createSchema(S).ifNotExists().execute();

		const schema = db.schema.withSchema(S);

		await schema
			.createTable("content_nodes")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("parent_id", "text", (c) =>
				c.references("content_nodes.id").onDelete("restrict"),
			)
			.addColumn("type", "text", (c) => c.notNull())
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("identifier", "text", (c) => c.notNull())
			.addColumn("position", "float8", (c) => c.notNull())
			.addColumn("deleted", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("show_in_overview", "boolean", (c) =>
				c.notNull().defaultTo(true),
			)
			.addColumn("columns_config", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'[]'::jsonb`),
			)
			.addColumn("default_view", "text")
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createIndex("content_nodes_tree_idx")
			.on("content_nodes")
			.columns(["workspace_id", "parent_id", "position"])
			.execute();

		// Section identifiers are unique per workspace (folders don't matter).
		await sql`
			create unique index content_nodes_section_identifier_unique
			on ${sql.id(S)}.${sql.id("content_nodes")} (workspace_id, lower(identifier))
			where type = 'section' and not deleted
		`.execute(db);
	},
};
