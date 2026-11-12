import type { Kysely } from "kysely";
import { applyAuthPlatformSchema } from "@twodb/core-platform/auth";

/**
 * org / workspace / space / workspace_member / api_key. These used to be
 * created only by the deprecated bootstrapControlPlaneDb(), so a FRESH
 * database never got them (first-user sign-up then failed creating its
 * workspace). All `ifNotExists`, so existing databases are untouched.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await applyAuthPlatformSchema(db as any);
}
