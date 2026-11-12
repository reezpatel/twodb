import { z } from "zod";
import { ulid } from "ulid";
import { route, type Ctx, type RouteDef } from "../lib/route.js";
import { resolveProject, assertInProject } from "../lib/access.js";
import { badRequest, notFound } from "../lib/http.js";
import { hydrateTickets } from "../lib/tickets.js";
import { logActivity, addWatcher, notifyWatchers } from "../lib/activity.js";
import { toApi } from "../lib/rows.js";
import { date, priority, ticketSchema } from "./schemas.js";

const csv = (s?: string) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined);

const SORTABLE: Record<string, string> = {
  position: "ticket.position", createdAt: "ticket.created_at", updatedAt: "ticket.updated_at", dueDate: "ticket.due_date",
  priority: "ticket.priority", title: "ticket.title", sequence: "ticket.sequence_number",
};

export const listFilters = z.object({
  statusId: z.string().optional().describe("comma-separated status ids"),
  statusCategory: z.string().optional().describe("comma-separated: backlog,todo,in_progress,done,canceled"),
  assigneeUserId: z.string().optional().describe("user id, comma-separated, or 'none'"),
  priority: z.string().optional().describe("comma-separated, or 'none'"),
  typeId: z.string().optional(),
  epicId: z.string().optional().describe("epic id or 'none'"),
  milestoneId: z.string().optional().describe("milestone id or 'none'"),
  labelId: z.string().optional().describe("comma-separated; ticket must have ANY"),
  parentId: z.string().optional().describe("parent ticket id or 'none' for top-level only"),
  q: z.string().optional().describe("title substring or identifier like PLAN-12"),
  dueBefore: date.optional(),
  dueAfter: date.optional(),
  archived: z.coerce.boolean().optional(),
});

export type ListFilters = z.infer<typeof listFilters>;

/** Applies the shared filter set (also used by saved views and exports). */
export function applyTicketFilters(q: any, f: ListFilters, projectKey: string) {
  const list = (v?: string) => csv(v);
  if (f.statusId) q = q.where("ticket.status_id", "in", list(f.statusId));
  if (f.statusCategory) q = q.where("status.category", "in", list(f.statusCategory));
  if (f.assigneeUserId) {
    const ids = list(f.assigneeUserId)!;
    const real = ids.filter((i) => i !== "none");
    q = ids.includes("none")
      ? q.where((eb: any) => eb.or([eb("ticket.assignee_user_id", "is", null), ...(real.length ? [eb("ticket.assignee_user_id", "in", real)] : [])]))
      : q.where("ticket.assignee_user_id", "in", ids);
  }
  if (f.priority) {
    const ps = list(f.priority)!;
    const real = ps.filter((i) => i !== "none");
    q = ps.includes("none")
      ? q.where((eb: any) => eb.or([eb("ticket.priority", "is", null), ...(real.length ? [eb("ticket.priority", "in", real)] : [])]))
      : q.where("ticket.priority", "in", ps);
  }
  if (f.typeId) q = q.where("ticket.type_id", "=", f.typeId);
  if (f.epicId) q = f.epicId === "none" ? q.where("ticket.epic_id", "is", null) : q.where("ticket.epic_id", "=", f.epicId);
  if (f.milestoneId) q = f.milestoneId === "none" ? q.where("ticket.milestone_id", "is", null) : q.where("ticket.milestone_id", "=", f.milestoneId);
  if (f.parentId) q = f.parentId === "none" ? q.where("ticket.parent_id", "is", null) : q.where("ticket.parent_id", "=", f.parentId);
  if (f.labelId) q = q.where("ticket.id", "in", (eb: any) => eb.selectFrom("ticket_label").select("ticket_id").where("label_id", "in", list(f.labelId)));
  if (f.dueBefore) q = q.where("ticket.due_date", "<=", f.dueBefore);
  if (f.dueAfter) q = q.where("ticket.due_date", ">=", f.dueAfter);
  if (f.q) {
    const m = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/.exec(f.q.trim());
    q =
      m && m[1].toUpperCase() === projectKey
        ? q.where("ticket.sequence_number", "=", Number(m[2]))
        : q.where("ticket.title", "ilike", `%${f.q.replace(/[%_]/g, "\\$&")}%`);
  }
  return q.where("ticket.archived_at", f.archived ? "is not" : "is", null);
}

export const ticketListRoutes: RouteDef[] = [
  route({
    name: "listTickets",
    method: "GET",
    path: "/projects/:projectId/tickets",
    description: "Lists tickets of a project with filters, sorting and pagination. Sub-tasks are included unless parentId=none.",
    request: listFilters.extend({
      projectId: z.string(),
      sort: z.enum(["position", "createdAt", "updatedAt", "dueDate", "priority", "title", "sequence"]).optional(),
      dir: z.enum(["asc", "desc"]).optional(),
      limit: z.coerce.number().int().min(1).max(1000).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    }),
    response: z.object({ items: z.array(ticketSchema), total: z.number() }),
    handler: async (ctx, input) => {
      const p = await resolveProject(ctx, input.projectId);
      const base = () =>
        applyTicketFilters(
          ctx.db.selectFrom("ticket").innerJoin("status", "status.id", "ticket.status_id").where("ticket.project_id", "=", p.id),
          input,
          p.key,
        );
      const dir = input.dir ?? "asc";
      // Priority sorts by urgency rank rather than alphabetically.
      let q = base().selectAll("ticket");
      q =
        input.sort === "priority"
          ? q.orderBy((eb: any) => eb.case().when("ticket.priority", "=", "urgent").then(0).when("ticket.priority", "=", "high").then(1).when("ticket.priority", "=", "medium").then(2).when("ticket.priority", "=", "low").then(3).else(4).end(), dir)
          : q.orderBy(SORTABLE[input.sort ?? "position"] as any, dir);
      q = q.orderBy("ticket.sequence_number", "asc").limit(input.limit ?? 500).offset(input.offset ?? 0);
      const [rows, total] = await Promise.all([q.execute(), base().select((eb: any) => eb.fn.countAll().as("c")).executeTakeFirst()]);
      return { items: await hydrateTickets(ctx, p.key, rows), total: Number((total as any)?.c ?? 0) };
    },
  }),
];

export interface CreateTicketInput {
  projectId: string;
  title: string;
  description?: string;
  statusId?: string;
  typeId?: string | null;
  epicId?: string | null;
  milestoneId?: string | null;
  parentId?: string | null;
  assigneeUserId?: string | null;
  priority?: string | null;
  estimatePoints?: number | null;
  estimateMinutes?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  labelIds?: string[];
  templateId?: string;
}

/** Shared by createTicket, the importers and "create from template". */
export async function createTicketRow(ctx: Ctx, project: Record<string, any>, input: Omit<CreateTicketInput, "projectId">) {
  return ctx.db.transaction().execute(async (trx) => {
    const t: Ctx = { ...ctx, db: trx };
    let tpl: Record<string, any> | undefined;
    if (input.templateId) {
      tpl = await trx.selectFrom("ticket_template").selectAll().where("id", "=", input.templateId).where("project_id", "=", project.id).executeTakeFirst();
      if (!tpl) throw notFound("template_not_found");
    }
    const merged = {
      ...input,
      title: input.title || tpl?.title || "Untitled",
      description: input.description ?? tpl?.description ?? "",
      typeId: input.typeId !== undefined ? input.typeId : tpl?.type_id ?? null,
      priority: input.priority !== undefined ? input.priority : tpl?.priority ?? null,
      labelIds: input.labelIds ?? (tpl?.label_ids as string[] | undefined) ?? [],
    };
    for (const [table, id] of [["epic", merged.epicId], ["milestone", merged.milestoneId], ["ticket_type", merged.typeId]] as const) await assertInProject(t, table, id, project.id);
    for (const l of merged.labelIds) await assertInProject(t, "label", l, project.id);
    if (merged.parentId) {
      const parent = await trx.selectFrom("ticket").select(["id", "parent_id"]).where("id", "=", merged.parentId).where("project_id", "=", project.id).executeTakeFirst();
      if (!parent) throw badRequest("parent ticket not found in this project");
      if (parent.parent_id) throw badRequest("sub-tasks can only be one level deep");
      if (!project.subtasks_enabled) throw badRequest("sub-tasks are disabled for this project");
    }
    let statusId = merged.statusId;
    if (statusId) await assertInProject(t, "status", statusId, project.id);
    else {
      const first = await trx.selectFrom("status").select("id").where("project_id", "=", project.id).where("category", "in", ["backlog", "todo"]).orderBy("position").executeTakeFirst()
        ?? (await trx.selectFrom("status").select("id").where("project_id", "=", project.id).orderBy("position").executeTakeFirst());
      if (!first) throw badRequest("project has no statuses");
      statusId = first.id as string;
    }
    // Atomic per-project counter: the row lock serialises concurrent creates.
    const seq = await trx.updateTable("project").set((eb) => ({ next_sequence: eb("next_sequence", "+", 1) })).where("id", "=", project.id).returning("next_sequence").executeTakeFirstOrThrow();
    const sequenceNumber = (seq.next_sequence as number) - 1;
    const max = await trx.selectFrom("ticket").select((eb) => eb.fn.max("position").as("m")).where("project_id", "=", project.id).where("status_id", "=", statusId!).executeTakeFirst();
    const row = await trx
      .insertInto("ticket")
      .values({
        id: ulid(), project_id: project.id, sequence_number: sequenceNumber, type_id: merged.typeId, epic_id: merged.epicId ?? null, milestone_id: merged.milestoneId ?? null,
        status_id: statusId, parent_id: merged.parentId ?? null, assignee_user_id: merged.assigneeUserId ?? null, title: merged.title, description: merged.description,
        priority: merged.priority, estimate_points: merged.estimatePoints ?? null, estimate_minutes: merged.estimateMinutes ?? null,
        start_date: merged.startDate ?? null, due_date: merged.dueDate ?? null, position: Number(max?.m ?? 0) + 1000, created_by: ctx.userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    if (merged.labelIds.length) await trx.insertInto("ticket_label").values(merged.labelIds.map((label_id: string) => ({ ticket_id: row.id, label_id }))).onConflict((oc) => oc.doNothing()).execute();
    if (tpl?.checklist?.length) {
      for (const [i, cl] of (tpl.checklist as { title: string; items: string[] }[]).entries()) {
        const cid = ulid();
        await trx.insertInto("ticket_checklist").values({ id: cid, ticket_id: row.id, title: cl.title, position: (i + 1) * 1000 }).execute();
        if (cl.items?.length) await trx.insertInto("ticket_checklist_item").values(cl.items.map((text, j) => ({ id: ulid(), checklist_id: cid, text, position: (j + 1) * 1000 }))).execute();
      }
    }
    await logActivity(t, row.id as string, "created");
    await addWatcher(t, row.id as string, ctx.userId);
    await addWatcher(t, row.id as string, merged.assigneeUserId ?? null);
    if (merged.assigneeUserId) await notifyWatchers(t, row.id as string, "assigned", `You were assigned ${project.key}-${sequenceNumber}: ${merged.title}`, [merged.assigneeUserId]);
    return row;
  });
}

export const ticketCreateRoute: RouteDef = route({
  name: "createTicket",
  method: "POST",
  path: "/projects/:projectId/tickets",
  description:
    "Creates a ticket (identifier KEY-n from the project's atomic counter). Defaults to the project's first backlog/todo status. " +
    "Sub-tasks are one level deep. `templateId` pre-fills from a ticket template.",
  request: z.object({
    projectId: z.string(), title: z.string().default(""), description: z.string().optional(), statusId: z.string().optional(),
    typeId: z.string().nullable().optional(), epicId: z.string().nullable().optional(), milestoneId: z.string().nullable().optional(),
    parentId: z.string().nullable().optional(), assigneeUserId: z.string().nullable().optional(), priority: priority.nullable().optional(),
    estimatePoints: z.number().nullable().optional(), estimateMinutes: z.number().int().nullable().optional(),
    startDate: date.nullable().optional(), dueDate: date.nullable().optional(), labelIds: z.array(z.string()).optional(), templateId: z.string().optional(),
  }),
  response: ticketSchema,
  handler: async (ctx, input) => {
    const p = await resolveProject(ctx, input.projectId);
    if (!input.title.trim() && !input.templateId) throw badRequest("title is required");
    const row = await createTicketRow(ctx, p, input);
    const [h] = await hydrateTickets(ctx, p.key, [row]);
    return h ?? toApi(row);
  },
});
