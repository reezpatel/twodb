import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";

export const roleKeyDescriptionMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.alterTable("roles")
			.addColumn("key", "text")
			.addColumn("description", "text")
			.execute();
		await sql`
			UPDATE roles
			SET key = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')),
			    description = ''
			WHERE key IS NULL
		`.execute(db);
		await db.schema
			.alterTable("roles")
			.alterColumn("key", (c) => c.setNotNull())
			.execute();
		await db.schema
			.createIndex("roles_workspace_key_unique")
			.on("roles")
			.columns(["workspace_id", "key"])
			.unique()
			.execute();
	},
};
