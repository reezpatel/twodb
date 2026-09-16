import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { CHAT_SCHEMA as S } from "..";

export const chatMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema.createSchema(S).ifNotExists().execute();
		const schema = db.schema.withSchema(S);

		await schema
			.createTable("chat_conversations")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("kind", "text", (c) => c.notNull())
			.addColumn("title", "text")
			.addColumn("slug", "text")
			.addColumn("parent_id", "text")
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
			.createIndex("chat_conversations_workspace_listing_idx")
			.on("chat_conversations")
			.columns(["workspace_id", "is_archived", "updated_at"])
			.execute();
		await sql`
			create unique index chat_channel_slug_unique
			on ${sql.id(S)}.${sql.id("chat_conversations")} (workspace_id, slug)
			where kind = 'channel' and slug is not null
		`.execute(db);

		await schema
			.createTable("chat_conversation_members")
			.addColumn("conversation_id", "text", (c) => c.notNull())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("user_id", "text", (c) => c.notNull())
			.addColumn("role", "text", (c) => c.notNull().defaultTo("member"))
			.addColumn("last_read_message_id", "text")
			.addColumn("last_read_at", "timestamptz")
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addPrimaryKeyConstraint("chat_conversation_members_pk", [
				"conversation_id",
				"user_id",
			])
			.execute();
		await sql`
			alter table ${sql.id(S)}.${sql.id("chat_conversation_members")}
			add constraint chat_members_conversation_fk
			foreign key (conversation_id) references ${sql.id(S)}.${sql.id("chat_conversations")} (id) on delete cascade
		`.execute(db);
		await schema
			.createIndex("chat_members_workspace_user_idx")
			.on("chat_conversation_members")
			.columns(["workspace_id", "user_id"])
			.execute();

		await schema
			.createTable("chat_messages")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("conversation_id", "text", (c) => c.notNull())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("parent_message_id", "text")
			.addColumn("markdown", "text", (c) => c.notNull().defaultTo(""))
			.addColumn("rich_blocks", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'[]'::jsonb`),
			)
			.addColumn("attachments", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'[]'::jsonb`),
			)
			.addColumn("is_deleted", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();
		await sql`
			alter table ${sql.id(S)}.${sql.id("chat_messages")}
			add constraint chat_messages_conversation_fk
			foreign key (conversation_id) references ${sql.id(S)}.${sql.id("chat_conversations")} (id) on delete cascade
		`.execute(db);
		await sql`
			alter table ${sql.id(S)}.${sql.id("chat_messages")}
			add constraint chat_messages_parent_fk
			foreign key (parent_message_id) references ${sql.id(S)}.${sql.id("chat_messages")} (id) on delete set null
		`.execute(db);
		await schema
			.createIndex("chat_messages_conversation_created_idx")
			.on("chat_messages")
			.columns(["conversation_id", "created_at"])
			.execute();

		await schema
			.createTable("chat_message_reactions")
			.addColumn("message_id", "text", (c) => c.notNull())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("user_id", "text", (c) => c.notNull())
			.addColumn("emoji", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addPrimaryKeyConstraint("chat_message_reactions_pk", [
				"message_id",
				"user_id",
				"emoji",
			])
			.execute();
		await sql`
			alter table ${sql.id(S)}.${sql.id("chat_message_reactions")}
			add constraint chat_reactions_message_fk
			foreign key (message_id) references ${sql.id(S)}.${sql.id("chat_messages")} (id) on delete cascade
		`.execute(db);

		await schema
			.createTable("chat_message_actions")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("message_id", "text", (c) => c.notNull())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("user_id", "text", (c) => c.notNull())
			.addColumn("action_id", "text", (c) => c.notNull())
			.addColumn("value", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'null'::jsonb`),
			)
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();
		await sql`
			alter table ${sql.id(S)}.${sql.id("chat_message_actions")}
			add constraint chat_actions_message_fk
			foreign key (message_id) references ${sql.id(S)}.${sql.id("chat_messages")} (id) on delete cascade
		`.execute(db);
	},
};
