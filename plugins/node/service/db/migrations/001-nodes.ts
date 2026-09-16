import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { NODE_SCHEMA as S } from "..";

export const nodesMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema.createSchema(S).ifNotExists().execute();

		const schema = db.schema.withSchema(S);

		await schema
			.createTable("node_nodes")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("status", "text", (c) => c.notNull().defaultTo("offline"))
			.addColumn("hostname", "text")
			.addColumn("platform", "text")
			.addColumn("arch", "text")
			.addColumn("node_version", "text")
			.addColumn("meta", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'{}'::jsonb`),
			)
			.addColumn("last_heartbeat", "jsonb")
			.addColumn("last_seen_at", "timestamptz")
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await schema
			.createIndex("node_nodes_workspace_status_idx")
			.on("node_nodes")
			.columns(["workspace_id", "status"])
			.execute();

		await sql`
			create unique index node_nodes_name_unique
			on ${sql.id(S)}.${sql.id("node_nodes")} (workspace_id, lower(name))
		`.execute(db);

		await schema
			.createTable("node_node_secrets")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("node_id", "text", (c) =>
				c.notNull().references("node_nodes.id").onDelete("cascade"),
			)
			.addColumn("workspace_id", "text", (c) => c.notNull())
			.addColumn("secret_hash", "text", (c) => c.notNull())
			.addColumn("label", "text")
			.addColumn("last_used_at", "timestamptz")
			.addColumn("revoked_at", "timestamptz")
			.addColumn("created_by", "text", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await sql`
			create unique index node_node_secrets_hash_unique
			on ${sql.id(S)}.${sql.id("node_node_secrets")} (secret_hash)
		`.execute(db);

		await schema
			.createIndex("node_node_secrets_node_idx")
			.on("node_node_secrets")
			.columns(["node_id"])
			.execute();
	},
};
