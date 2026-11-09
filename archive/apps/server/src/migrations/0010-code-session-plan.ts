import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/** Per-session plan for the get_plan/update_plan tools — steps with statuses, full-replacement semantics. */
export const up: Migration["up"] = async () => {
  await db.schema
    .alterTable("code_session")
    .addColumn("plan", sql`jsonb`)
    .execute();
};
