import type { Ctx } from "./route.js";
import { toApi } from "./rows.js";

/** Adds identifier, labelIds and subtask counts to raw ticket rows of ONE project. */
export async function hydrateTickets(ctx: Ctx, projectKey: string, rows: Record<string, any>[]) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id as string);
  const [labels, subs] = await Promise.all([
    ctx.db.selectFrom("ticket_label").select(["ticket_id", "label_id"]).where("ticket_id", "in", ids).execute(),
    ctx.db
      .selectFrom("ticket")
      .innerJoin("status", "status.id", "ticket.status_id")
      .select("ticket.parent_id as parent_id")
      .select((eb) => eb.fn.countAll().as("total"))
      .select((eb) => eb.fn.countAll().filterWhere("status.category", "in", ["done", "canceled"]).as("done"))
      .where("ticket.parent_id", "in", ids)
      .where("ticket.archived_at", "is", null)
      .groupBy("ticket.parent_id")
      .execute(),
  ]);
  const labelMap = new Map<string, string[]>();
  for (const l of labels) labelMap.set(l.ticket_id as string, [...(labelMap.get(l.ticket_id as string) ?? []), l.label_id as string]);
  const subMap = new Map(subs.map((s: any) => [s.parent_id, s]));
  return rows.map((r) => ({
    ...toApi(r),
    identifier: `${projectKey}-${r.sequence_number}`,
    labelIds: labelMap.get(r.id) ?? [],
    subtaskCount: Number(subMap.get(r.id)?.total ?? 0),
    subtaskDoneCount: Number(subMap.get(r.id)?.done ?? 0),
  }));
}

export const TICKET_PATCH_FIELDS = [
  "title", "description", "priority", "statusId", "typeId", "epicId", "milestoneId", "parentId", "assigneeUserId",
  "estimatePoints", "estimateMinutes", "startDate", "dueDate", "position",
] as const;

/** Tracked fields -> activity labels. */
export const FIELD_LABEL: Record<string, string> = {
  title: "title", description: "description", priority: "priority", statusId: "status", typeId: "type", epicId: "epic",
  milestoneId: "milestone", parentId: "parent", assigneeUserId: "assignee", estimatePoints: "points",
  estimateMinutes: "time estimate", startDate: "start date", dueDate: "due date",
};
