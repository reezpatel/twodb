import type { Kysely } from "kysely";

/** Checkpoint catalog — snapshot objects live in the repo under refs/twodb/checkpoints/*. */
export async function up(db: Kysely<unknown>): Promise<void> {
  const text = "text" as const;
  const timestamptz = "timestamptz" as const;

  await db.schema
    .createTable("code_checkpoint")
    .ifNotExists()
    .addColumn("id", text)
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("sessionId", text, (c) => c.notNull())
    .addColumn("codeDirectoryId", text, (c) => c.notNull())
    .addColumn("label", text)
    .addColumn("ref", text, (c) => c.notNull())
    .addColumn("commitSha", text, (c) => c.notNull())
    .addColumn("trigger", text, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("code_checkpoint_pkey", ["id"])
    .execute();

  await db.schema.createIndex("code_checkpoint_session_idx").on("code_checkpoint").columns(["sessionId", "createdAt"]).execute();
}
