import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/**
 * code_session.interactive: true → the agent may ask the user questions
 * (ask_user) and steerable via the chat; false → headless subagent run
 * (ask_user returns an error; steering input still queues/records but the
 * agent never pauses for the user). Main sessions and /btw threads are
 * interactive; agent-invoked subagents are not.
 *
 * code_session.depthCount: invocation depth of a child session. Main sessions
 * start at 0; each child is parent.depthCount + 1. invoke_subagent refuses to
 * spawn beyond depth 3.
 */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("code_session").addColumn("interactive", sql`boolean`, (c) => c.defaultTo(true).notNull()).execute();
  await db.schema.alterTable("code_session").addColumn("depthCount", sql`integer`, (c) => c.defaultTo(0).notNull()).execute();
};