import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export function buildMigrations(): Record<string, Migration> {
	return {
		"001-core-tenancy": {
			async up(db: Kysely<unknown>) {
				await db.schema
					.createTable("users")
					.addColumn("id", "text", (c) => c.primaryKey())
					.addColumn("identifier", "text", (c) => c.notNull())
					.addColumn("email", "text")
					.addColumn("phone", "text")
					.addColumn("name", "text", (c) => c.notNull())
					.addColumn("password_hash", "text", (c) => c.notNull())
					.addColumn("email_verified_at", "timestamptz")
					.addColumn("phone_verified_at", "timestamptz")
					.addColumn("created_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.execute();

				await db.schema
					.createIndex("users_identifier_unique")
					.on("users")
					.column("identifier")
					.unique()
					.execute();

				await db.schema
					.createTable("sessions")
					.addColumn("id", "text", (c) => c.primaryKey())
					.addColumn("user_id", "text", (c) =>
						c.notNull().references("users.id").onDelete("cascade"),
					)
					.addColumn("token_hash", "text", (c) => c.notNull().unique())
					.addColumn("auth_method", "text", (c) => c.notNull())
					.addColumn("expires_at", "timestamptz", (c) => c.notNull())
					.addColumn("created_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.execute();

				await db.schema
					.createTable("platform_admins")
					.addColumn("user_id", "text", (c) =>
						c.notNull().references("users.id").onDelete("cascade"),
					)
					.addColumn("granted_by", "text")
					.addColumn("created_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.addPrimaryKeyConstraint("platform_admins_pk", ["user_id"])
					.execute();

				await db.schema
					.createTable("organizations")
					.addColumn("id", "text", (c) => c.primaryKey())
					.addColumn("name", "text", (c) => c.notNull())
					.addColumn("slug", "text", (c) => c.notNull().unique())
					.addColumn("created_by", "text", (c) =>
						c.notNull().references("users.id"),
					)
					.addColumn("created_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.execute();

				await db.schema
					.createTable("org_memberships")
					.addColumn("org_id", "text", (c) =>
						c.notNull().references("organizations.id").onDelete("cascade"),
					)
					.addColumn("user_id", "text", (c) =>
						c.notNull().references("users.id").onDelete("cascade"),
					)
					.addColumn("is_admin", "boolean", (c) => c.notNull())
					.addColumn("created_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.addPrimaryKeyConstraint("org_memberships_pk", ["org_id", "user_id"])
					.execute();

				await db.schema
					.createTable("workspaces")
					.addColumn("id", "text", (c) => c.primaryKey())
					.addColumn("org_id", "text", (c) =>
						c.notNull().references("organizations.id").onDelete("cascade"),
					)
					.addColumn("name", "text", (c) => c.notNull())
					.addColumn("slug", "text", (c) => c.notNull())
					.addColumn("created_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.execute();

				await db.schema
					.createIndex("workspaces_org_slug_unique")
					.on("workspaces")
					.columns(["org_id", "slug"])
					.unique()
					.execute();

				await db.schema
					.createTable("workspace_members")
					.addColumn("workspace_id", "text", (c) =>
						c.notNull().references("workspaces.id").onDelete("cascade"),
					)
					.addColumn("user_id", "text", (c) =>
						c.notNull().references("users.id").onDelete("cascade"),
					)
					.addColumn("created_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.addPrimaryKeyConstraint("workspace_members_pk", [
						"workspace_id",
						"user_id",
					])
					.execute();
			},
		},
	};
}
