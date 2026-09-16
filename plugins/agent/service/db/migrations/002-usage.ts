import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { AGENT_SCHEMA as S } from "..";

export const usageMigration: Migration = {
	async up(db: Kysely<unknown>) {
		const schema = db.schema.withSchema(S);

		await schema
			.alterTable("agent_agents")
			.addColumn("usage_last_fetched_at", "timestamptz")
			.addColumn("usage_last_error", "text")
			.execute();

		await schema
			.createTable("agent_usage_snapshots")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("agent_id", "text", (c) =>
				c.notNull().references("agent_agents.id").onDelete("cascade"),
			)
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("captured_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("window_type", "text", (c) => c.notNull())
			.addColumn("group_label", "text", (c) => c.notNull().defaultTo(""))
			.addColumn("total", "float8", (c) => c.notNull())
			.addColumn("used", "float8", (c) => c.notNull())
			.addColumn("unit", "text", (c) => c.notNull())
			.addColumn("reset_at", "timestamptz")
			.execute();

		await schema
			.createIndex("agent_usage_snapshots_agent_idx")
			.on("agent_usage_snapshots")
			.columns(["agent_id", "captured_at"])
			.execute();
	},
};
