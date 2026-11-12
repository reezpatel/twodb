import { z } from "zod";
import { ulid } from "ulid";
import { projectCrud } from "../lib/crud.js";
import { route, type Ctx, type RouteDef } from "../lib/route.js";
import { resolveProject, assertInProject } from "../lib/access.js";
import { toApi, toApiList } from "../lib/rows.js";
import { notFound } from "../lib/http.js";
import { date, epicStatus, priority, epicSchema, milestoneSchema, ok } from "./schemas.js";

/** Rollup per grouping column: ticket counts by status category and point totals. */
async function progress(ctx: Ctx, projectId: string, col: "epic_id" | "milestone_id") {
  const rows = await ctx.db
    .selectFrom("ticket")
    .innerJoin("status", "status.id", "ticket.status_id")
    .select([`ticket.${col} as gid`, "status.category as category"])
    .select((eb) => eb.fn.countAll().as("count"))
    .select((eb) => eb.fn.sum("ticket.estimate_points").as("points"))
    .where("ticket.project_id", "=", projectId)
    .where("ticket.archived_at", "is", null)
    .where(`ticket.${col}` as any, "is not", null)
    .groupBy([`ticket.${col}`, "status.category"] as any)
    .execute();
  const out = new Map<string, { total: number; done: number; canceled: number; inProgress: number; points: number; donePoints: number }>();
  for (const r of rows as any[]) {
    const e = out.get(r.gid) ?? { total: 0, done: 0, canceled: 0, inProgress: 0, points: 0, donePoints: 0 };
    const c = Number(r.count);
    const pts = Number(r.points ?? 0);
    e.total += c;
    e.points += pts;
    if (r.category === "done") { e.done += c; e.donePoints += pts; }
    if (r.category === "canceled") e.canceled += c;
    if (r.category === "in_progress") e.inProgress += c;
    out.set(r.gid, e);
  }
  return out;
}

const blank = { total: 0, done: 0, canceled: 0, inProgress: 0, points: 0, donePoints: 0 };
const progressSchema = z.object({ total: z.number(), done: z.number(), canceled: z.number(), inProgress: z.number(), points: z.number(), donePoints: z.number() });

const epicCrud = projectCrud({
  entity: "Epic",
  plural: "Epics",
  table: "epic",
  segment: "epics",
  touch: true,
  columns: ["title", "description", "status", "ownerUserId", "priority", "startDate", "targetDate", "position"],
  create: z.object({
    title: z.string().min(1), description: z.string().optional(), status: epicStatus.optional(), ownerUserId: z.string().nullable().optional(),
    priority: priority.nullable().optional(), startDate: date.nullable().optional(), targetDate: date.nullable().optional(), position: z.number().optional(),
  }),
  update: z.object({
    title: z.string().min(1).optional(), description: z.string().optional(), status: epicStatus.optional(), ownerUserId: z.string().nullable().optional(),
    priority: priority.nullable().optional(), startDate: date.nullable().optional(), targetDate: date.nullable().optional(), position: z.number().optional(),
  }),
  response: epicSchema,
});

// The generic list returns bare rows; epics are always shown with progress + labels, so override it.
const epicList = route({
  name: "listEpics",
  method: "GET",
  path: "/projects/:projectId/epics",
  description: "Epics of a project with ticket progress rollups and labels.",
  request: z.object({ projectId: z.string() }),
  response: z.array(epicSchema.extend({ progress: progressSchema, labelIds: z.array(z.string()) })),
  handler: async (ctx, { projectId }) => {
    const p = await resolveProject(ctx, projectId);
    const [rows, prog, labels] = await Promise.all([
      ctx.db.selectFrom("epic").selectAll().where("project_id", "=", p.id).orderBy("position").execute(),
      progress(ctx, p.id, "epic_id"),
      ctx.db.selectFrom("epic_label").innerJoin("epic", "epic.id", "epic_label.epic_id").select(["epic_label.epic_id", "epic_label.label_id"]).where("epic.project_id", "=", p.id).execute(),
    ]);
    return rows.map((r: any) => ({ ...toApi(r), progress: prog.get(r.id) ?? blank, labelIds: labels.filter((l: any) => l.epic_id === r.id).map((l: any) => l.label_id) }));
  },
});

const milestoneCrud = projectCrud({
  entity: "Milestone",
  plural: "Milestones",
  table: "milestone",
  segment: "milestones",
  position: null,
  orderBy: "start_date",
  touch: true,
  columns: ["name", "goal", "startDate", "endDate"],
  create: z.object({ name: z.string().min(1), goal: z.string().optional(), startDate: date, endDate: date }),
  update: z.object({ name: z.string().min(1).optional(), goal: z.string().optional(), startDate: date.optional(), endDate: date.optional() }),
  response: milestoneSchema,
});

const milestoneList = route({
  name: "listMilestones",
  method: "GET",
  path: "/projects/:projectId/milestones",
  description: "Milestones (sprint-like, time-boxed) with progress and a derived state: upcoming | active | completed.",
  request: z.object({ projectId: z.string() }),
  response: z.array(milestoneSchema.extend({ progress: progressSchema, state: z.enum(["upcoming", "active", "completed"]) })),
  handler: async (ctx, { projectId }) => {
    const p = await resolveProject(ctx, projectId);
    const [rows, prog] = await Promise.all([
      ctx.db.selectFrom("milestone").selectAll().where("project_id", "=", p.id).orderBy("start_date").execute(),
      progress(ctx, p.id, "milestone_id"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return rows.map((r: any) => {
      const a = toApi<any>(r);
      const state = a.completedAt || a.endDate < today ? "completed" : a.startDate > today ? "upcoming" : "active";
      return { ...a, progress: prog.get(r.id) ?? blank, state };
    });
  },
});

const named = (routes: RouteDef[], name: string) => routes.filter((r) => r.spec.name !== name);

export const epicMilestoneRoutes: RouteDef[] = [
  ...named(epicCrud, "listEpics"),
  epicList,
  ...named(milestoneCrud, "listMilestones"),
  milestoneList,
  route({
    name: "getEpic",
    method: "GET",
    path: "/projects/:projectId/epics/:id",
    description: "One epic with progress and labels.",
    request: z.object({ projectId: z.string(), id: z.string() }),
    response: epicSchema.extend({ progress: progressSchema, labelIds: z.array(z.string()) }),
    handler: async (ctx, { projectId, id }) => {
      const p = await resolveProject(ctx, projectId);
      const r = await ctx.db.selectFrom("epic").selectAll().where("id", "=", id).where("project_id", "=", p.id).executeTakeFirst();
      if (!r) throw notFound("epic_not_found");
      const [prog, labels] = await Promise.all([progress(ctx, p.id, "epic_id"), ctx.db.selectFrom("epic_label").select("label_id").where("epic_id", "=", id).execute()]);
      return { ...toApi(r), progress: prog.get(id) ?? blank, labelIds: labels.map((l: any) => l.label_id) };
    },
  }),
  route({
    name: "setEpicLabels",
    method: "PUT",
    path: "/projects/:projectId/epics/:id/labels",
    description: "Replaces an epic's labels.",
    request: z.object({ projectId: z.string(), id: z.string(), labelIds: z.array(z.string()) }),
    response: ok,
    handler: async (ctx, { projectId, id, labelIds }) => {
      const p = await resolveProject(ctx, projectId);
      await assertInProject(ctx, "epic", id, p.id, "epic");
      for (const l of labelIds) await assertInProject(ctx, "label", l, p.id, "label");
      await ctx.db.transaction().execute(async (trx) => {
        await trx.deleteFrom("epic_label").where("epic_id", "=", id).execute();
        if (labelIds.length) await trx.insertInto("epic_label").values(labelIds.map((label_id) => ({ epic_id: id, label_id }))).execute();
      });
      return { ok: true };
    },
  }),
  route({
    name: "completeMilestone",
    method: "POST",
    path: "/projects/:projectId/milestones/:id/complete",
    description:
      "Finishes a milestone early (sets completedAt; endDate stays the planned date). With moveOpenTo, unfinished tickets roll over to another milestone " +
      "(or to none with moveOpenTo=null). reopen=true clears completion.",
    request: z.object({ projectId: z.string(), id: z.string(), reopen: z.boolean().optional(), moveOpenTo: z.string().nullable().optional() }),
    response: milestoneSchema,
    handler: async (ctx, { projectId, id, reopen, moveOpenTo }) => {
      const p = await resolveProject(ctx, projectId);
      await assertInProject(ctx, "milestone", id, p.id, "milestone");
      if (moveOpenTo) await assertInProject(ctx, "milestone", moveOpenTo, p.id, "milestone");
      if (!reopen && moveOpenTo !== undefined) {
        await ctx.db
          .updateTable("ticket")
          .set({ milestone_id: moveOpenTo, updated_at: new Date() })
          .where("milestone_id", "=", id)
          .where("status_id", "in", (eb: any) => eb.selectFrom("status").select("id").where("project_id", "=", p.id).where("category", "in", ["backlog", "todo", "in_progress"]))
          .execute();
      }
      const row = await ctx.db.updateTable("milestone").set({ completed_at: reopen ? null : new Date(), updated_at: new Date() }).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
      return toApi(row);
    },
  }),
  route({
    name: "getTimeline",
    method: "GET",
    path: "/projects/:projectId/timeline",
    description:
      "Data for the timeline (gantt) view: epics, milestones and dated tickets with their date ranges, grouped by epic. Tickets without any date are omitted.",
    request: z.object({ projectId: z.string() }),
    response: z.object({ epics: z.array(z.any()), milestones: z.array(z.any()), tickets: z.array(z.any()) }),
    handler: async (ctx, { projectId }) => {
      const p = await resolveProject(ctx, projectId);
      const [epics, milestones, tickets, prog] = await Promise.all([
        ctx.db.selectFrom("epic").selectAll().where("project_id", "=", p.id).orderBy("position").execute(),
        ctx.db.selectFrom("milestone").selectAll().where("project_id", "=", p.id).orderBy("start_date").execute(),
        ctx.db
          .selectFrom("ticket").innerJoin("status", "status.id", "ticket.status_id")
          .select(["ticket.id", "ticket.sequence_number", "ticket.title", "ticket.epic_id", "ticket.milestone_id", "ticket.start_date", "ticket.due_date", "ticket.assignee_user_id", "ticket.priority", "status.category as status_category", "status.color as status_color"])
          .where("ticket.project_id", "=", p.id).where("ticket.archived_at", "is", null)
          .where((eb: any) => eb.or([eb("ticket.start_date", "is not", null), eb("ticket.due_date", "is not", null)]))
          .orderBy("ticket.start_date").execute(),
        progress(ctx, p.id, "epic_id"),
      ]);
      return {
        epics: epics.map((e: any) => ({ ...toApi(e), progress: prog.get(e.id) ?? blank })),
        milestones: toApiList(milestones),
        tickets: tickets.map((t: any) => ({ ...toApi(t), identifier: `${p.key}-${t.sequence_number}` })),
      };
    },
  }),
];

void ulid;
