import type { Migration } from "kysely/migration";
import { calendarMigration } from "./001-calendar";

export function buildMigrations(): Record<string, Migration> {
	return {
		"001-calendar": calendarMigration,
	};
}
