import type { Migration } from "kysely/migration";
import { db } from "../auth";

/**
 * Assistant merges into code sessions (codeDirectoryId = null). Assistant data
 * is intentionally dropped — fresh start. Canvas artifacts move to a
 * code-session table so update_canvas works everywhere.
 */
export const up: Migration["up"] = async () => {
  await db.schema.dropTable("assistant_thread").execute();
  await db.schema.dropTable("assistant_message").execute();
  await db.schema.dropTable("assistant_artifact").execute();
  await db.schema
    .createTable("code_session_artifact")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("sessionId", "text", (c) => c.notNull())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamp", (c) => c.notNull())
    .addColumn("updatedAt", "timestamp", (c) => c.notNull())
    .addUniqueConstraint("code_session_artifact_session_title_unique", ["sessionId", "title"])
    .execute();
};
