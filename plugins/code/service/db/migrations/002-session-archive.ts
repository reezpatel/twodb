import type { Kysely } from "kysely";
import type { Migration } from "kysely/migration";
import { CODE_SCHEMA as S } from "..";

export const sessionArchiveMigration: Migration = {
	async up(db: Kysely<unknown>) {
		await db.schema
			.withSchema(S)
			.alterTable("code_sessions")
			.addColumn("archived_at", "timestamptz")
			.execute();
	},
};
