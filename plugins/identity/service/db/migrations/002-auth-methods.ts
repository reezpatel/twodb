import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const authMethodsMigration: Migration = {
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
};
