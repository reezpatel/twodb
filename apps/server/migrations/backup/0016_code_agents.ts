import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("agent")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("workspaceId", "text", (c) => c.notNull().references("workspace.id").onDelete("cascade"))
    .addColumn("provider", "text", (c) => c.notNull())
    .addColumn("model", "text", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("instruction", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull())
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull())
    .execute();

  await db.schema.createIndex("agent_workspace_idx").on("agent").column("workspaceId").execute();

  await db.schema
    .alterTable("code_session")
    .addColumn("agentId", "text", (c) => c.references("agent.id").onDelete("set null"))
    .execute();
  await db.schema.alterTable("code_session").addColumn("runtimeState", "jsonb").execute();

  await db.schema.createIndex("code_session_agent_idx").on("code_session").column("agentId").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("code_session").dropColumn("runtimeState").execute();
  await db.schema.alterTable("code_session").dropColumn("agentId").execute();
  await db.schema.dropTable("agent").execute();
}
