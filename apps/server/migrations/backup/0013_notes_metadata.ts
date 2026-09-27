import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("note_group").addColumn("metadata", "jsonb").execute();
  await db.schema.alterTable("note_folder").addColumn("metadata", "jsonb").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("note_folder").dropColumn("metadata").execute();
  await db.schema.alterTable("note_group").dropColumn("metadata").execute();
}
