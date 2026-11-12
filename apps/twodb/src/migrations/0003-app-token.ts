import type { Kysely } from "kysely";

/** Token table the gateway validates `x-twodb-app` + `x-twodb-token` against. Hash-only. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("app_token")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("slug", "text", (c) => c.notNull())
    .addColumn("token_hash", "text", (c) => c.notNull().unique())
    .addColumn("kind", "text", (c) => c.notNull())
    .addColumn("created_at", "text", (c) => c.notNull())
    .addColumn("expires_at", "text")
    .addColumn("revoked_at", "text")
    .addColumn("last_used_at", "text")
    .execute();
  await db.schema.createIndex("app_token_slug_idx").ifNotExists().on("app_token").column("slug").execute();
}
