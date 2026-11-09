import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/**
 * Generic per-user footer/UI preferences. Keyed by (organizationId, userId, key);
 * value is opaque JSON owned by the client (e.g. llm_usage → { metrics: [...] }).
 */
export const up: Migration["up"] = async () => {
  await db.schema
    .createTable("footer_preference")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("key", "text", (c) => c.notNull())
    .addColumn("value", sql`jsonb`, (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("footer_preference_unique", ["organizationId", "userId", "key"])
    .execute();

  await db.schema.createIndex("footer_preference_scope_idx").on("footer_preference").columns(["organizationId", "userId"]).execute();

  await db.schema
    .alterTable("footer_preference")
    .addForeignKeyConstraint("footer_preference_organizationId_fkey", ["organizationId"], "organization", ["id"], (c) => c.onDelete("cascade"))
    .execute();
};
