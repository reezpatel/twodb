import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/**
 * Spaces — user-defined groupings inside an organization. Selection is
 * per-user client state; APIs opt into filtering by the `x-space-ids` header.
 */
export const up: Migration["up"] = async () => {
  await db.schema
    .createTable("space")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("space_name_unique", ["organizationId", "name"])
    .execute();

  await db.schema.createIndex("space_org_idx").on("space").columns(["organizationId"]).execute();

  await db.schema
    .alterTable("space")
    .addForeignKeyConstraint("space_organizationId_fkey", ["organizationId"], "organization", ["id"], (c) => c.onDelete("cascade"))
    .execute();
};