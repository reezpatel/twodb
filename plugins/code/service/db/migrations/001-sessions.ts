import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { CODE_SCHEMA as S } from "..";

export const sessionsMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema.createSchema(S).ifNotExists().execute();

		const schema = db.schema.withSchema(S);

		await schema
			.createTable("code_sessions")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("node_id", "text", (c) => c.notNull())
			.addColumn("cwd", "text", (c) => c.notNull().defaultTo("."))
			.addColumn("is_git", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("title", "text")
			.addColumn("worktree_path", "text")
			.addColumn("thread_id", "text")
			.addColumn("agent_id", "text")
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createIndex("code_sessions_workspace_idx")
			.on("code_sessions")
			.columns(["workspace_id"])
			.execute();

		// Sessions group into "projects" by their location on a node.
		await schema
			.createIndex("code_sessions_location_idx")
			.on("code_sessions")
			.columns(["workspace_id", "node_id", "cwd"])
			.execute();
	},
};
