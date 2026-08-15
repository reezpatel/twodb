import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export function buildMigrations(): Record<string, Migration> {
	return {
		"001-notes": {
			async up(db: Kysely<unknown>) {
				await db.schema
					.createTable("notes")
					.addColumn("id", "text", (c) => c.primaryKey())
					.addColumn("workspace_id", "text", (c) =>
						c.notNull().references("workspaces.id").onDelete("cascade"),
					)
					.addColumn("title", "text", (c) => c.notNull())
					.addColumn("body", "text", (c) => c.notNull().defaultTo(""))
					.addColumn("created_by", "text", (c) =>
						c.notNull().references("users.id"),
					)
					.addColumn("created_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.addColumn("updated_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.execute();
				await db.schema
					.createIndex("notes_workspace_idx")
					.on("notes")
					.column("workspace_id")
					.execute();
			},
		},
	};
}
