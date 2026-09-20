import type { Migration } from "kysely/migration";
import { sessionsMigration } from "./001-sessions";
import { sessionArchiveMigration } from "./002-session-archive";

export function buildMigrations(): Record<string, Migration> {
	return {
		"001-sessions": sessionsMigration,
		"002-session-archive": sessionArchiveMigration,
	};
}
