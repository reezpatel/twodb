import type { Kysely } from "kysely";

/** Short-lived, single-use authorization codes for the first-party "Login with TwoDB" flow (PKCE). */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("oauth_code")
    .ifNotExists()
    .addColumn("code_hash", "text", (c) => c.primaryKey())
    .addColumn("user_id", "text", (c) => c.notNull())
    .addColumn("code_challenge", "text", (c) => c.notNull())
    .addColumn("redirect_uri", "text", (c) => c.notNull())
    .addColumn("expires_at", "text", (c) => c.notNull())
    .addColumn("used_at", "text")
    .execute();
}
