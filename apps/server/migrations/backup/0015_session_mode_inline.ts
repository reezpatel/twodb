import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("code_session").addColumn("mode", "jsonb").execute();

  await db.schema.alterTable("code_session").dropColumn("currentMode").execute();

  await db.schema.dropTable("mode").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("mode")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspaceId", "text", (c) => c.notNull().references("workspace.id").onDelete("cascade"))
    .addColumn("type", "text", (c) => c.notNull())
    .addColumn("instruction", "text", (c) => c.notNull())
    .addColumn("commands", "jsonb", (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("mode_workspace_type_unique", ["workspaceId", "type"])
    .execute();

  await db.schema.alterTable("code_session").addColumn("currentMode", "text").execute();

  await db.schema.alterTable("code_session").dropColumn("mode").execute();
}
