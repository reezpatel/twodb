import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/** Adds per-session tags — skills tagged "default" or with a matching tag load into the system prompt. */
export const up: Migration["up"] = async () => {
  await db.schema
    .alterTable("code_session")
    .addColumn("tags", sql`text[]`, (c) => c.defaultTo(sql`'{}'::text[]`).notNull())
    .execute();
};
