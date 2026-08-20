import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { CONTENT_SCHEMA as S } from "..";

export const viewsMigration: Migration = {
	async up(db: Kysely<unknown>) {
		const schema = db.schema.withSchema(S);

		await schema
			.createTable("content_views")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("section_id", "text", (c) =>
				c.notNull().references("content_nodes.id").onDelete("cascade"),
			)
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("type", "text", (c) => c.notNull())
			.addColumn("config", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'{}'::jsonb`),
			)
			.addColumn("is_default", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("position", "float8", (c) => c.notNull())
			.addColumn("deleted", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createIndex("content_views_section_idx")
			.on("content_views")
			.columns(["section_id", "position"])
			.execute();

		// One default view per section.
		await sql`
			create unique index content_views_one_default
			on ${sql.id(S)}.${sql.id("content_views")} (section_id)
			where is_default and not deleted
		`.execute(db);
	},
};
