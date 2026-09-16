import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { AGENT_SCHEMA as S } from "..";

export const threadsMigration: Migration = {
	async up(db: Kysely<unknown>) {
		const schema = db.schema.withSchema(S);

		await schema
			.createTable("agent_threads")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("agent_id", "text", (c) => c.notNull())
			.addColumn("thread_intent", "text")
			.addColumn("is_archived", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createIndex("agent_threads_workspace_idx")
			.on("agent_threads")
			.columns(["workspace_id", "is_archived"])
			.execute();

		await sql`
			alter table ${sql.id(S)}.${sql.id("agent_threads")}
			add constraint agent_threads_agent_fk
			foreign key (agent_id) references ${sql.id(S)}.${sql.id("agent_agents")} (id) on delete cascade
		`.execute(db);

		await schema
			.createTable("agent_messages")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("thread_id", "text", (c) => c.notNull())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("seq", "integer", (c) => c.notNull())
			.addColumn("role", "text", (c) => c.notNull())
			.addColumn("message", "jsonb", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await sql`
			create unique index agent_messages_thread_seq_unique
			on ${sql.id(S)}.${sql.id("agent_messages")} (thread_id, seq)
		`.execute(db);

		await sql`
			alter table ${sql.id(S)}.${sql.id("agent_messages")}
			add constraint agent_messages_thread_fk
			foreign key (thread_id) references ${sql.id(S)}.${sql.id("agent_threads")} (id) on delete cascade
		`.execute(db);
	},
};
