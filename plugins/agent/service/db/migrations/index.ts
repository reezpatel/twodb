import type { Migration } from "kysely/migration";
import { agentsMigration } from "./001-agents";
import { usageMigration } from "./002-usage";
import { threadsMigration } from "./003-threads";

export function buildMigrations(): Record<string, Migration> {
	return {
		"001-agents": agentsMigration,
		"002-usage": usageMigration,
		"003-threads": threadsMigration,
	};
}
