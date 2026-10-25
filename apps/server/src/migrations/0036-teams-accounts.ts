import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** Teams bridge: one row per Teams account (company) watched by a runner-side
 *  Chromium session. Status is runner-pushed; events become notifications. */

export const up: Migration["up"] = async () => {
  await db.schema
    .createTable("teams_account")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("userId", "text", (c) => c.notNull())
    .addColumn("runnerId", "text", (c) => c.notNull())
    .addColumn("label", "text", (c) => c.notNull())
    .addColumn("email", "text")
    .addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("status", "text", (c) => c.notNull().defaultTo("idle"))
    .addColumn("lastError", "text")
    .addColumn("lastEventAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();
  await db.schema.createIndex("teams_account_org_idx").on("teams_account").columns(["organizationId", "userId"]).execute();
  await db.schema
    .alterTable("teams_account")
    .addForeignKeyConstraint("teams_account_runnerId_fkey", ["runnerId"], "runner", ["id"], (c) => c.onDelete("cascade"))
    .execute();
};
