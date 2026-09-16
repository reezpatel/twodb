import type { Migration } from "kysely/migration";
import { meetingsMigration } from "./001-meetings";

export function buildMigrations(): Record<string, Migration> {
	return {
		"001-meetings": meetingsMigration,
	};
}
