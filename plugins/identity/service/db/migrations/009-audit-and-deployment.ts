import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const auditAndDeploymentMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.createTable("audit_log")
			.addColumn("id", "text", (c) => c.notNull())
			.addColumn("actor", "text", (c) => c.notNull().references("users.id"))
			.addColumn("action", "text", (c) => c.notNull())
			.addColumn("target", "text", (c) => c.notNull())
			.addColumn("payload", "jsonb", (c) =>
				c.notNull().defaultTo(sql`'{}'::jsonb`),
			)
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();
		await sql`
			ALTER TABLE audit_log ADD PRIMARY KEY (id)
		`.execute(db);
		await db.schema
			.createIndex("audit_log_created_idx")
			.on("audit_log")
			.column("created_at")
			.execute();

		await db.schema
			.createTable("deployment_settings")
			.addColumn("key", "text", (c) => c.notNull())
			.addColumn("value", "jsonb", (c) => c.notNull())
			.addColumn("updated_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();
		await sql`
			ALTER TABLE deployment_settings ADD PRIMARY KEY (key)
		`.execute(db);

		await sql`
			ALTER TABLE organizations ADD COLUMN suspended_at timestamptz
		`.execute(db);
	},
};
