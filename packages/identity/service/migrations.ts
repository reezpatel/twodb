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
		"002-auth-methods": {
			async up(db: Kysely<unknown>) {
				await db.schema
					.createTable("user_auth_methods")
					.addColumn("id", "text", (c) => c.primaryKey())
					.addColumn("user_id", "text", (c) =>
						c.notNull().references("users.id").onDelete("cascade"),
					)
					.addColumn("method", "text", (c) => c.notNull())
					.addColumn("credential", "jsonb", (c) => c.notNull())
					.addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(true))
					.addColumn("created_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.execute();

				await db.schema
					.createIndex("user_auth_methods_user_method_unique")
					.on("user_auth_methods")
					.columns(["user_id", "method"])
					.unique()
					.execute();

				await db.schema
					.createTable("deployment_auth_methods")
					.addColumn("method", "text", (c) => c.primaryKey())
					.addColumn("config", "jsonb", (c) => c.notNull())
					.addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(false))
					.execute();

				await db.schema
					.createTable("verification_codes")
					.addColumn("id", "text", (c) => c.primaryKey())
					.addColumn("identifier", "text", (c) => c.notNull())
					.addColumn("code_hash", "text", (c) => c.notNull())
					.addColumn("purpose", "text", (c) => c.notNull())
					.addColumn("attempts", "integer", (c) => c.notNull().defaultTo(0))
					.addColumn("expires_at", "timestamptz", (c) => c.notNull())
					.addColumn("created_at", "timestamptz", (c) =>
						c.notNull().defaultTo(sql`now()`),
					)
					.execute();

				await db.schema
					.createIndex("verification_codes_identifier_purpose")
					.on("verification_codes")
					.columns(["identifier", "purpose"])
					.execute();

				// Retrofit task-02: the password hash moves off the users row into
				// a user_auth_methods row (method 'password').
				await sql`
					insert into user_auth_methods (id, user_id, method, credential, enabled, created_at)
					select 'amt-' || replace(gen_random_uuid()::text, '-', ''),
					       id, 'password', jsonb_build_object('hash', password_hash), true, now()
					from users
				`.execute(db);

				await db.schema.alterTable("users").dropColumn("password_hash").execute();
			},
		},
		"003-roles-and-grants": {
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
		},
	};
}
