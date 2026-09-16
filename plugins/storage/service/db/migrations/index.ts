import type { Migration } from "kysely/migration";
import { storageMigration } from "./001-storage";

export function buildMigrations(): Record<string, Migration> {
	return {
		"001-storage": storageMigration,
	};
}
