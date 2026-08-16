import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const rolesAndGrantsMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.createTable("roles")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) =>
				c.notNull().references("workspaces.id").onDelete("cascade"),
			)
			.addColumn("name", "text", (c) => c.notNull())
			.addColumn("is_system", "boolean", (c) => c.notNull().defaultTo(false))
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await db.schema
			.createIndex("roles_workspace_name_unique")
			.on("roles")
			.columns(["workspace_id", "name"])
			.unique()
			.execute();

		await db.schema
			.createTable("role_claims")
			.addColumn("role_id", "text", (c) =>
				c.notNull().references("roles.id").onDelete("cascade"),
			)
			.addColumn("claim", "text", (c) => c.notNull())
			.addPrimaryKeyConstraint("role_claims_pk", ["role_id", "claim"])
			.execute();

		await db.schema
			.createTable("workspace_role_assignments")
			.addColumn("workspace_id", "text", (c) =>
				c.notNull().references("workspaces.id").onDelete("cascade"),
			)
			.addColumn("user_id", "text", (c) =>
				c.notNull().references("users.id").onDelete("cascade"),
			)
			.addColumn("role_id", "text", (c) =>
				c.notNull().references("roles.id").onDelete("cascade"),
			)
			.addColumn("assigned_by", "text")
			.addColumn("assigned_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.addPrimaryKeyConstraint("workspace_role_assignments_pk", [
				"workspace_id",
				"user_id",
				"role_id",
			])
			.execute();

		await db.schema
			.createTable("entity_grants")
			.addColumn("id", "text", (c) => c.primaryKey())
			.addColumn("workspace_id", "text", (c) =>
				c.notNull().references("workspaces.id").onDelete("cascade"),
			)
			.addColumn("user_id", "text", (c) =>
				c.notNull().references("users.id").onDelete("cascade"),
			)
			.addColumn("entity_type", "text", (c) => c.notNull())
			.addColumn("entity_id", "text", (c) => c.notNull())
			.addColumn("claims", sql`text[]`, (c) => c.notNull())
			.addColumn("granted_by", "text")
			.addColumn("created_at", "timestamptz", (c) =>
				c.notNull().defaultTo(sql`now()`),
			)
			.execute();

		await db.schema
			.createIndex("entity_grants_target_unique")
			.on("entity_grants")
			.columns(["workspace_id", "user_id", "entity_type", "entity_id"])
			.unique()
			.execute();
	},
};
