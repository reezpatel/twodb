import type { Migration } from "kysely/migration";
import { nodesMigration } from "./001-nodes";
import { viewsMigration } from "./002-views";
import { notesMigration } from "./003-notes";

export function buildMigrations(): Record<string, Migration> {
	return {
		"001-nodes": nodesMigration,
		"002-views": viewsMigration,
		"003-notes": notesMigration,
	};
}
