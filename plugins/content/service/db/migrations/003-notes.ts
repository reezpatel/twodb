import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { CONTENT_SCHEMA as S } from "..";

export const notesMigration: Migration = {
	async up(db: Kysely<unknown>) {
		const schema = db.schema.withSchema(S);

		await schema
			.createTable("content_notes")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("section_id", "text", (c) =>
				c.notNull().references("content_nodes.id").onDelete("cascade"),
			)
			.addColumn("title", "text", (c) => c.notNull().defaultTo(""))
			.addColumn("content", "text", (c) => c.notNull().defaultTo(""))
			.addColumn("completed", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("deleted", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("position", "float8", (c) => c.notNull().defaultTo(0))
			.addColumn("tags", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'[]'::jsonb`),
			)
			.addColumn("links", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'[]'::jsonb`),
			)
			.addColumn("attachments", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'[]'::jsonb`),
			)
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createIndex("content_notes_workspace_idx")
			.on("content_notes")
			.column("workspace_id")
			.execute();

		// Hot path: row listings of one section, ordered, excluding trash.
		await sql`
			create index content_notes_section_listing_idx
			on ${sql.id(S)}.${sql.id("content_notes")} (section_id, position)
			where not deleted
		`.execute(db);
	},
};
