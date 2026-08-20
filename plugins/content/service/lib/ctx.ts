import type { Kysely } from "kysely";
import type { ContentDB } from "../db/schema";

export interface ContentCtx {
	db: Kysely<ContentDB>;
}
