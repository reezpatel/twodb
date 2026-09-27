import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("llm_connection").dropColumn("runnerId").execute();

  await db.schema.alterTable("code_session").addColumn("runnerId", "text").execute();

  await db.schema
    .alterTable("code_session_message")
    .addColumn("meta", "jsonb", (c) => c.defaultTo(sql`null`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("code_session_message").dropColumn("meta").execute();
  await db.schema.alterTable("code_session").dropColumn("runnerId").execute();
  await db.schema.alterTable("llm_connection").addColumn("runnerId", "text").execute();
}
