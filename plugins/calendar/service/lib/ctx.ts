import type { Kysely } from "kysely";
import type { CalendarDB } from "../db/schema";

export interface CalendarCtx {
	db: Kysely<CalendarDB>;
	/** AES-GCM box for account credentials; null when no key is configured. */
	credentialsKey: string | null;
}
