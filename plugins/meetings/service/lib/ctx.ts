import type { Kysely } from "kysely";
import type { MeetingsDB } from "../db/schema";

export interface MeetingsCtx {
	db: Kysely<MeetingsDB>;
}
