import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { AGENT_SCHEMA as S } from "..";

export const agentsMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema.createSchema(S).ifNotExists().execute();

		const schema = db.schema.withSchema(S);

		await schema
			.createTable("agent_agents")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("description", "text")
			.addColumn("provider", "text", (c) => c.notNull())
			.addColumn("auth_type", "text", (c) => c.notNull().defaultTo("api_key"))
			.addColumn("secret_encrypted", "text")
			.addColumn("config", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'{}'::jsonb`),
			)
			.addColumn("model", "text")
			.addColumn("system_prompt", "text")
			.addColumn("options", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'{}'::jsonb`),
			)
			.addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(true))
			.addColumn("last_verified_at", "timestamptz")
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createIndex("agent_agents_workspace_provider_idx")
			.on("agent_agents")
			.columns(["workspace_id", "provider"])
			.execute();

		await sql`
			create unique index agent_agents_name_unique
			on ${sql.id(S)}.${sql.id("agent_agents")} (workspace_id, lower(name))
		`.execute(db);
	},
};
