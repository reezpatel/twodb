import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** Uploaded chat assets, stored via the agent_assets destination and referenced as twodb://<backendId>/<mediaId>. */
export const up: Migration["up"] = async () => {
  await db.schema
    .createTable("media_asset")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("sessionId", "text")
    .addColumn("backendId", "text", (c) => c.notNull())
    .addColumn("path", "text", (c) => c.notNull())
    .addColumn("filename", "text", (c) => c.notNull())
    .addColumn("extension", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("contentType", "text")
    .addColumn("size", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("createdAt", "timestamp", (c) => c.notNull())
    .execute();
};
