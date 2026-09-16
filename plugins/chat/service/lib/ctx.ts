import type { Kysely } from "kysely";
import type { ChatDB } from "../db/schema";

export type ChatCtx = { db: Kysely<ChatDB> };
