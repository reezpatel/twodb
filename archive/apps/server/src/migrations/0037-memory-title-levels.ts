import type { Migration } from "kysely/migration";
import { db } from "../auth";

/**
 * Memories get a title (listed by default; content is read on demand) and an
 * owner level: organization | code_directory | agent (self) — plus the legacy
 * session level, kept so existing session-bound memories keep working.
 *
 * scope: workspace → organization, project → code_directory, session unchanged.
 * agentId: set for scope=agent (a persona / collaborator / sentinel's own memory).
 * title: backfilled from the first line of existing content, deduped per level.
 */
export const up: Migration["up"] = async () => {
  await db.schema.alterTable("memory").addColumn("title", "text").execute();
  await db.schema.alterTable("memory").addColumn("agentId", "text").execute();
  await db.schema
    .alterTable("memory")
    .addForeignKeyConstraint("memory_agentId_fkey", ["agentId"], "agent", ["id"], (c) => c.onDelete("cascade"))
    .execute();

  await db.updateTable("memory").set({ scope: "organization" }).where("scope", "=", "workspace" as never).execute();
  await db.updateTable("memory").set({ scope: "code_directory" }).where("scope", "=", "project" as never).execute();

  const rows = await db.selectFrom("memory").select(["id", "organizationId", "scope", "codeDirectoryId", "scopeId", "content"]).orderBy("createdAt", "asc").execute();
  const taken = new Set<string>();
  for (const row of rows) {
    const firstLine = row.content.split("\n").find((l) => l.trim()) ?? "Memory";
    const base = firstLine.trim().replace(/\s+/g, " ").slice(0, 60) || "Memory";
    const level = `${row.organizationId}|${row.scope}|${row.codeDirectoryId ?? ""}|${row.scopeId ?? ""}`;
    let title = base;
    for (let n = 2; taken.has(`${level}|${title.toLowerCase()}`); n++) title = `${base} (${n})`;
    taken.add(`${level}|${title.toLowerCase()}`);
    await db.updateTable("memory").set({ title }).where("id", "=", row.id).execute();
  }

  await db.schema.alterTable("memory").alterColumn("title", (c) => c.setNotNull()).execute();
  await db.schema.createIndex("memory_agent_idx").on("memory").columns(["agentId"]).execute();
};
