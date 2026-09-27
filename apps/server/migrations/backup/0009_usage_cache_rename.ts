import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("llm_usage_event").renameColumn("cached_input_tokens", "cachedInputTokens").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("llm_usage_event").renameColumn("cachedInputTokens", "cached_input_tokens").execute();
}
