import type { Kysely } from "kysely";

/** Per-thread thinking level for assistant chats (off/low/medium/high; null = medium). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("assistant_thread").addColumn("thinkingLevel", "text").execute();
}
