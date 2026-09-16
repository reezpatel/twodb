import type { Kysely } from "kysely";
import type { CodeDB } from "../db/schema";

export interface CodeCtx {
	db: Kysely<CodeDB>;
}
