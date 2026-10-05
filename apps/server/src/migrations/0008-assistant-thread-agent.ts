import type { Migration } from "kysely/migration";
import { sql } from "kysely";
import { db } from "../auth";

/** Assistant threads: optional agent binding (its system prompt applies) + tags for skill/instruction matching. */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("assistant_thread").addColumn("agentId", "text").execute();
  await db.schema
    .alterTable("assistant_thread")
    .addColumn("tags", sql`text[]`, (c) => c.defaultTo(sql`'{}'::text[]`).notNull())
    .execute();
};
