import type { Migration } from "kysely/migration";
import { chatMigration } from "./001-chat";

export function buildMigrations(): Record<string, Migration> {
	return { "001-chat": chatMigration };
}
