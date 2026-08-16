import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const appsMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.createTable("apps")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) =>
				c.notNull().references("workspaces.id").onDelete("cascade"),
			)
			.addColumn("slug", "text", (c) => c.notNull())
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("manifest", "jsonb", (c) => c.notNull())
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();
		await db.schema
			.createIndex("apps_workspace_slug_unique")
			.on("apps")
			.columns(["workspace_id", "slug"])
			.unique()
			.execute();

		await db.schema
			.createTable("app_roles")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("app_id", "text", (c) =>
				c.notNull().references("apps.id").onDelete("cascade"),
			)
			.addColumn("key", "text", (c) => c.notNull())
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("description", "text")
			.addColumn("is_system", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();
		await db.schema
			.createIndex("app_roles_app_key_unique")
			.on("app_roles")
			.columns(["app_id", "key"])
			.unique()
			.execute();

		await db.schema
			.createTable("app_role_claims")
			.addColumn("app_role_id", "text", (c) =>
				c.notNull().references("app_roles.id").onDelete("cascade"),
			)
			.addColumn("claim", "text", (c) => c.notNull())
			.addPrimaryKeyConstraint("app_role_claims_pk", ["app_role_id", "claim"])
			.execute();

		await db.schema
			.createTable("app_role_assignments")
			.addColumn("id", "text", (c) => c.notNull())
			.addColumn("app_id", "text", (c) =>
				c.notNull().references("apps.id").onDelete("cascade"),
			)
			.addColumn("user_id", "text", (c) =>
				c.notNull().references("users.id").onDelete("cascade"),
			)
			.addColumn("app_role_id", "text", (c) =>
				c.notNull().references("app_roles.id").onDelete("cascade"),
			)
			.addColumn("assigned_by", "text")
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();
		await sql`
			ALTER TABLE app_role_assignments
			ADD PRIMARY KEY (id)
		`.execute(db);
		await sql`
			CREATE UNIQUE INDEX app_role_assignments_unique
			ON app_role_assignments (app_id, user_id, app_role_id)
		`.execute(db);
	},
};
