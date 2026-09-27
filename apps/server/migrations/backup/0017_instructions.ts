import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("instruction")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspaceId", "text", (c) => c.notNull().references("workspace.id").onDelete("cascade"))
    .addColumn("machineId", "text", (c) => c.notNull())
    .addColumn("instruction", "text", (c) => c.notNull())
    .addColumn("instructionPath", "text", (c) => c.notNull())
    .addColumn("hash", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .addUniqueConstraint("instruction_workspace_machine_path_unique", ["workspaceId", "machineId", "instructionPath"])
    .execute();

  await db.schema.createIndex("instruction_workspace_idx").on("instruction").column("workspaceId").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("instruction").execute();
}
