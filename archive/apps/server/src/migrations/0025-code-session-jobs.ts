import type { Migration } from "kysely/migration";
import { db } from "../auth";

/** Background jobs per code session — started via run_background, tracked to
 * completion, output delivered into the thread as a user message. */
export const up: Migration["up"] = async () => {
  await db.schema
    .createTable("code_session_job")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("sessionId", "text", (c) => c.notNull())
    .addColumn("organizationId", "text", (c) => c.notNull())
    .addColumn("runnerId", "text", (c) => c.notNull())
    .addColumn("command", "text", (c) => c.notNull())
    .addColumn("cwd", "text")
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("exitCode", "integer")
    .addColumn("logPath", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("finishedAt", "timestamptz")
    .execute();

  await db.schema
    .createIndex("code_session_job_session_idx")
    .on("code_session_job")
    .columns(["sessionId", "createdAt"])
    .execute();
};
