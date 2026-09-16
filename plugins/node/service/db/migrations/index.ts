import type { Migration } from "kysely/migration";
import { nodesMigration } from "./001-nodes";

export function buildMigrations(): Record<string, Migration> {
	return {
		"001-nodes": nodesMigration,
	};
}
