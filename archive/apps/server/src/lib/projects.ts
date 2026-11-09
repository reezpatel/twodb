import { db } from "../auth";
import type { ProjectStatusTable, StatusCategory } from "../plugins/db";

/** Shared helpers for the projects routes — identifier allocation, default
 * statuses, access checks, dependency cycle detection. */

export const DEFAULT_STATUSES: { name: string; color: string; category: StatusCategory; position: number }[] = [
  { name: "Backlog", color: "#94a3b8", category: "backlog", position: 0 },
  { name: "Todo", color: "#60a5fa", category: "todo", position: 1 },
  { name: "In Progress", color: "#f59e0b", category: "in_progress", position: 2 },
  { name: "In Review", color: "#a78bfa", category: "in_progress", position: 3 },
  { name: "Done", color: "#34d399", category: "done", position: 4 },
  { name: "Canceled", color: "#6b7280", category: "canceled", position: 5 },
];

export async function seedDefaultStatuses(projectId: string, editable: "yes" | "sync" = "yes"): Promise<ProjectStatusTable[]> {
  const rows = DEFAULT_STATUSES.map((s) => ({
    id: crypto.randomUUID(),
    projectId,
    subprojectId: null,
    editable,
    createdAt: new Date(),
    ...s,
  }));
  await db.insertInto("project_status").values(rows).execute();
  return rows as unknown as ProjectStatusTable[];
}

/** The status set a subproject uses: its override set if any, else the project's. */
export async function statusesForSubproject(projectId: string, subprojectId: string): Promise<ProjectStatusTable[]> {
  const overrides = await db
    .selectFrom("project_status")
    .selectAll()
    .where("projectId", "=", projectId)
    .where("subprojectId", "=", subprojectId)
    .orderBy("position")
    .execute();
  if (overrides.length) return overrides;
  return db.selectFrom("project_status").selectAll().where("projectId", "=", projectId).where("subprojectId", "is", null).orderBy("position").execute();
}

/** First non-backlog, non-canceled status — where new tickets land. */
export function defaultStatusFor(statuses: ProjectStatusTable[]): ProjectStatusTable | undefined {
  return statuses.find((s) => s.category === "todo") ?? statuses.find((s) => s.category !== "backlog" && s.category !== "canceled") ?? statuses[0];
}

/** Allocate the next ticket number for a project atomically. Returns the number. */
export async function allocateTicketNumber(projectId: string): Promise<number> {
  const row = await db
    .updateTable("project")
    .set((eb) => ({ nextTicketNumber: eb("nextTicketNumber", "+", 1) }))
    .where("id", "=", projectId)
    .returning(["nextTicketNumber"])
    .executeTakeFirstOrThrow();
  return row.nextTicketNumber - 1;
}

/** Would adding dependency ticketId→dependsOnTicketId create a cycle? Follows
 * the chain from dependsOnTicketId up through its own blockers. */
export async function wouldCreateDependencyCycle(ticketId: string, dependsOnTicketId: string): Promise<boolean> {
  const deps = await db.selectFrom("ticket_dependency").selectAll().execute();
  const blockers = new Map<string, string[]>();
  for (const d of deps) {
    const list = blockers.get(d.ticketId) ?? [];
    list.push(d.dependsOnTicketId);
    blockers.set(d.ticketId, list);
  }
  // Walk from dependsOnTicketId; if we can reach ticketId, adding the edge cycles.
  const stack = [dependsOnTicketId];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === ticketId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of blockers.get(cur) ?? []) stack.push(next);
  }
  return false;
}
