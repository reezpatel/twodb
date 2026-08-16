import { sql, type Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { IDENTITY_SCHEMA as S } from "..";

export const assignmentIdMigration: Migration = {
	async up(db: Kysely<unknown>) {
		const schema = db.schema.withSchema(S);
		const assignments = sql.id(S, "workspace_role_assignments");

		await schema
			.alterTable("workspace_role_assignments")
			.addColumn("id", "text")
			.addColumn("created_at", "timestamptz", (c) => c.defaultTo(sql`now()`))
			.execute();
		await sql`
			UPDATE ${assignments}
			SET id = 'asg-' || replace(gen_random_uuid()::text, '-', '')
			WHERE id IS NULL
		`.execute(db);
		await sql`
			UPDATE ${assignments}
			SET created_at = now()
			WHERE created_at IS NULL
		`.execute(db);
		await sql`
			ALTER TABLE ${assignments}
			ALTER COLUMN id SET NOT NULL,
			ALTER COLUMN created_at SET NOT NULL
		`.execute(db);
		await sql`
			ALTER TABLE ${assignments}
			DROP CONSTRAINT workspace_role_assignments_pk
		`.execute(db);
		await sql`
			ALTER TABLE ${assignments}
			ADD PRIMARY KEY (id)
		`.execute(db);
		await sql`
			CREATE UNIQUE INDEX workspace_role_assignments_unique
			ON ${assignments} (workspace_id, user_id, role_id)
		`.execute(db);
	},
};
