import type { Kysely } from "kysely";

/**
 * Single-use codes for the `twodb auth` CLI login flow (hash only), binding
 * the PKCE challenge, the loopback redirect and the requested API-key name.
 *
 * Split from 0006 deliberately: 0006 was first recorded by a dev server that
 * hot-reloaded mid-edit (column only), so the table creation lives here where
 * every database — fresh or already-migrated — will run it. ifNotExists keeps
 * it idempotent.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("cli_code")
    .ifNotExists()
    .addColumn("code_hash", "text", (c) => c.primaryKey())
    .addColumn("user_id", "text", (c) => c.notNull())
    .addColumn("code_challenge", "text", (c) => c.notNull())
    .addColumn("redirect_uri", "text", (c) => c.notNull())
    .addColumn("key_name", "text", (c) => c.notNull())
    .addColumn("expires_at", "text", (c) => c.notNull())
    .addColumn("used_at", "text")
    .execute();
}
