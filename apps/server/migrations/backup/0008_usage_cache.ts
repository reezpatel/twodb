import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("llm_usage_event")
    .addColumn("cached_input_tokens", "integer", (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("llm_usage_event").dropColumn("cached_input_tokens").execute();
}
