import { z } from "zod";
import { ulid } from "ulid";
import { route, type Ctx, type RouteDef } from "../lib/route.js";
import { resolveProject } from "../lib/access.js";
import { toApi, toApiList } from "../lib/rows.js";
import { conflict, notFound } from "../lib/http.js";
import { DEFAULT_STATUSES, DEFAULT_TYPES } from "./config.js";
import { projectSchema, anyObject, ok } from "./schemas.js";

const key = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/, "2-10 chars, letters/digits, starting with a letter"));

/** Snapshot of a project's reusable configuration (what a project template stores). */
async function snapshotConfig(ctx: Ctx, projectId: string) {
  const q = (t: string, order: string) => ctx.db.selectFrom(t as any).selectAll().where("project_id", "=", projectId).orderBy(order as any).execute();
  const [statuses, types, groups, labels, fields, templates] = await Promise.all([
    q("status", "position"),
    q("ticket_type", "position"),
    q("label_group", "position"),
    q("label", "name"),
    q("custom_field", "position"),
    q("ticket_template", "position"),
  ]);
  const options = fields.length
    ? await ctx.db.selectFrom("custom_field_option").selectAll().where("field_id", "in", fields.map((f: any) => f.id)).orderBy("position").execute()
    : [];
  const project = await ctx.db.selectFrom("project").selectAll().where("id", "=", projectId).executeTakeFirstOrThrow();
  const groupName = new Map(groups.map((g: any) => [g.id, g.name]));
  const typeName = new Map(types.map((t: any) => [t.id, t.name]));
  const labelName = new Map(labels.map((l: any) => [l.id, l.name]));
  return {
    settings: {
      pointsEstimateEnabled: project.points_estimate_enabled,
      timeEstimateEnabled: project.time_estimate_enabled,
      subtasksEnabled: project.subtasks_enabled,
      checklistsEnabled: project.checklists_enabled,
    },
    statuses: statuses.map((s: any) => ({ name: s.name, color: s.color, category: s.category })),
    ticketTypes: types.map((t: any) => ({ name: t.name, icon: t.icon, color: t.color })),
    labelGroups: groups.map((g: any) => g.name),
    labels: labels.map((l: any) => ({ name: l.name, color: l.color, group: l.group_id ? groupName.get(l.group_id) ?? null : null })),
    customFields: fields.map((f: any) => ({
      name: f.name,
      type: f.type,
      options: options.filter((o: any) => o.field_id === f.id).map((o: any) => ({ label: o.label, color: o.color })),
    })),
    ticketTemplates: templates.map((t: any) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      type: t.type_id ? typeName.get(t.type_id) ?? null : null,
      priority: t.priority,
      labels: (t.label_ids as string[]).map((id) => labelName.get(id)).filter(Boolean),
      checklist: t.checklist,
    })),
  };
}

type Snapshot = Awaited<ReturnType<typeof snapshotConfig>>;

async function seedProject(ctx: Ctx, projectId: string, cfg: Partial<Snapshot> | undefined) {
  const db = ctx.db;
  const statuses = cfg?.statuses?.length ? cfg.statuses : DEFAULT_STATUSES;
  await db.insertInto("status").values(statuses.map((s, i) => ({ id: ulid(), project_id: projectId, name: s.name, color: s.color, category: s.category, position: (i + 1) * 1000 }))).execute();
  const types = cfg?.ticketTypes?.length ? cfg.ticketTypes : DEFAULT_TYPES;
  const typeIds = new Map<string, string>();
  await db.insertInto("ticket_type").values(types.map((t, i) => { const id = ulid(); typeIds.set(t.name, id); return { id, project_id: projectId, name: t.name, icon: t.icon, color: t.color, position: (i + 1) * 1000 }; })).execute();
  if (!cfg) return;
  const groupIds = new Map<string, string>();
  for (const [i, name] of (cfg.labelGroups ?? []).entries()) {
    const id = ulid();
    groupIds.set(name, id);
    await db.insertInto("label_group").values({ id, project_id: projectId, name, position: (i + 1) * 1000 }).execute();
  }
  const labelIds = new Map<string, string>();
  for (const l of cfg.labels ?? []) {
    const id = ulid();
    labelIds.set(l.name, id);
    await db.insertInto("label").values({ id, project_id: projectId, name: l.name, color: l.color, group_id: l.group ? groupIds.get(l.group) ?? null : null }).execute();
  }
  for (const [i, f] of (cfg.customFields ?? []).entries()) {
    const id = ulid();
    await db.insertInto("custom_field").values({ id, project_id: projectId, name: f.name, type: f.type, position: (i + 1) * 1000 }).execute();
    for (const [j, o] of f.options.entries()) await db.insertInto("custom_field_option").values({ id: ulid(), field_id: id, label: o.label, color: o.color, position: (j + 1) * 1000 }).execute();
  }
  for (const [i, t] of (cfg.ticketTemplates ?? []).entries()) {
    await db
      .insertInto("ticket_template")
      .values({
        id: ulid(), project_id: projectId, name: t.name, title: t.title, description: t.description,
        type_id: t.type ? typeIds.get(t.type) ?? null : null, priority: t.priority,
        label_ids: JSON.stringify((t.labels as string[]).map((n) => labelIds.get(n)).filter(Boolean)),
        checklist: JSON.stringify(t.checklist ?? []), position: (i + 1) * 1000,
      })
      .execute();
  }
}

const templateSchema = z.object({ id: z.string(), workspaceId: z.string(), name: z.string(), description: z.string(), createdAt: z.string() });

export const projectRoutes: RouteDef[] = [
  route({
    name: "listProjects",
    method: "GET",
    path: "/projects",
    description: "Lists projects in the workspace (optionally one space). Workspace members see every space and project.",
    request: z.object({ spaceId: z.string().optional(), includeArchived: z.coerce.boolean().optional() }),
    response: z.array(projectSchema.extend({ ticketCount: z.number(), openTicketCount: z.number() })),
    handler: async (ctx, { spaceId, includeArchived }) => {
      let q = ctx.db.selectFrom("project").selectAll().where("workspace_id", "=", ctx.workspaceId).orderBy("name");
      if (spaceId) q = q.where("space_id", "=", spaceId);
      if (!includeArchived) q = q.where("archived_at", "is", null);
      const projects = await q.execute();
      if (!projects.length) return [];
      const counts = await ctx.db
        .selectFrom("ticket")
        .innerJoin("status", "status.id", "ticket.status_id")
        .select(["ticket.project_id as pid"])
        .select((eb) => eb.fn.countAll().as("total"))
        .select((eb) => eb.fn.countAll().filterWhere("status.category", "in", ["backlog", "todo", "in_progress"]).as("open"))
        .where("ticket.project_id", "in", projects.map((p) => p.id))
        .where("ticket.archived_at", "is", null)
        .groupBy("ticket.project_id")
        .execute();
      const byId = new Map(counts.map((c: any) => [c.pid, c]));
      return projects.map((p) => ({ ...toApi(p), ticketCount: Number(byId.get(p.id)?.total ?? 0), openTicketCount: Number(byId.get(p.id)?.open ?? 0) }));
    },
  }),
  route({
    name: "createProject",
    method: "POST",
    path: "/projects",
    description:
      "Creates a project inside a space with a unique key (tickets become KEY-1, KEY-2, …). Seeds the default workflow, or copies a project template's configuration.",
    request: z.object({ spaceId: z.string().min(1), key, name: z.string().min(1), description: z.string().optional(), icon: z.string().optional(), templateId: z.string().optional() }),
    response: projectSchema,
    handler: async (ctx, input) => {
      const dup = await ctx.db.selectFrom("project").select("id").where("workspace_id", "=", ctx.workspaceId).where("key", "=", input.key).executeTakeFirst();
      if (dup) throw conflict(`project key ${input.key} is already in use`);
      let cfg: Snapshot | undefined;
      if (input.templateId) {
        const t = await ctx.db.selectFrom("project_template").selectAll().where("id", "=", input.templateId).where("workspace_id", "=", ctx.workspaceId).executeTakeFirst();
        if (!t) throw notFound("template_not_found");
        cfg = t.config as Snapshot;
      }
      const id = ulid();
      const row = await ctx.db
        .insertInto("project")
        .values({
          id, workspace_id: ctx.workspaceId, space_id: input.spaceId, key: input.key, name: input.name, description: input.description ?? "", icon: input.icon ?? null, created_by: ctx.userId,
          ...(cfg?.settings
            ? { points_estimate_enabled: cfg.settings.pointsEstimateEnabled, time_estimate_enabled: cfg.settings.timeEstimateEnabled, subtasks_enabled: cfg.settings.subtasksEnabled, checklists_enabled: cfg.settings.checklistsEnabled }
            : {}),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await seedProject(ctx, id, cfg);
      return toApi(row);
    },
  }),
  route({
    name: "getProject",
    method: "GET",
    path: "/projects/:projectId",
    description: "One project by id or key.",
    request: z.object({ projectId: z.string() }),
    response: projectSchema,
    handler: async (ctx, { projectId }) => toApi(await resolveProject(ctx, projectId)),
  }),
  route({
    name: "updateProject",
    method: "PATCH",
    path: "/projects/:projectId",
    description: "Renames or reconfigures a project (feature toggles, estimate kinds). The key is immutable.",
    request: z.object({
      projectId: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      icon: z.string().nullable().optional(),
      spaceId: z.string().optional(),
      pointsEstimateEnabled: z.boolean().optional(),
      timeEstimateEnabled: z.boolean().optional(),
      subtasksEnabled: z.boolean().optional(),
      checklistsEnabled: z.boolean().optional(),
    }),
    response: projectSchema,
    handler: async (ctx, input) => {
      const p = await resolveProject(ctx, input.projectId);
      const patch: Record<string, any> = { updated_at: new Date() };
      const map: Record<string, string> = { name: "name", description: "description", icon: "icon", spaceId: "space_id", pointsEstimateEnabled: "points_estimate_enabled", timeEstimateEnabled: "time_estimate_enabled", subtasksEnabled: "subtasks_enabled", checklistsEnabled: "checklists_enabled" };
      for (const [k, col] of Object.entries(map)) if ((input as any)[k] !== undefined) patch[col] = (input as any)[k];
      return toApi(await ctx.db.updateTable("project").set(patch).where("id", "=", p.id).returningAll().executeTakeFirstOrThrow());
    },
  }),
  route({
    name: "archiveProject",
    method: "POST",
    path: "/projects/:projectId/archive",
    description: "Archives (or restores, with restore=true) a project.",
    request: z.object({ projectId: z.string(), restore: z.boolean().optional() }),
    response: projectSchema,
    handler: async (ctx, { projectId, restore }) => {
      const p = await resolveProject(ctx, projectId);
      return toApi(await ctx.db.updateTable("project").set({ archived_at: restore ? null : new Date(), updated_at: new Date() }).where("id", "=", p.id).returningAll().executeTakeFirstOrThrow());
    },
  }),
  route({
    name: "deleteProject",
    method: "DELETE",
    path: "/projects/:projectId",
    description: "Permanently deletes a project and everything in it.",
    request: z.object({ projectId: z.string() }),
    response: ok,
    handler: async (ctx, { projectId }) => {
      const p = await resolveProject(ctx, projectId);
      await ctx.db.deleteFrom("project").where("id", "=", p.id).execute();
      return { ok: true };
    },
  }),

  route({
    name: "listProjectTemplates",
    method: "GET",
    path: "/project-templates",
    description: "Project templates of the workspace.",
    response: z.array(templateSchema),
    handler: async (ctx) => toApiList(await ctx.db.selectFrom("project_template").select(["id", "workspace_id", "name", "description", "created_at"]).where("workspace_id", "=", ctx.workspaceId).orderBy("name").execute()),
  }),
  route({
    name: "saveProjectAsTemplate",
    method: "POST",
    path: "/projects/:projectId/save-as-template",
    description: "Snapshots a project's statuses, types, labels, custom fields, settings and ticket templates into a reusable project template.",
    request: z.object({ projectId: z.string(), name: z.string().min(1), description: z.string().optional() }),
    response: templateSchema,
    handler: async (ctx, { projectId, name, description }) => {
      const p = await resolveProject(ctx, projectId);
      const dup = await ctx.db.selectFrom("project_template").select("id").where("workspace_id", "=", ctx.workspaceId).where("name", "=", name).executeTakeFirst();
      if (dup) throw conflict("a template with this name already exists");
      const config = await snapshotConfig(ctx, p.id);
      const row = await ctx.db
        .insertInto("project_template")
        .values({ id: ulid(), workspace_id: ctx.workspaceId, name, description: description ?? "", config: JSON.stringify(config), created_by: ctx.userId })
        .returning(["id", "workspace_id", "name", "description", "created_at"])
        .executeTakeFirstOrThrow();
      return toApi(row);
    },
  }),
  route({
    name: "deleteProjectTemplate",
    method: "DELETE",
    path: "/project-templates/:id",
    description: "Deletes a project template (projects created from it are unaffected).",
    request: z.object({ id: z.string() }),
    response: ok,
    handler: async (ctx, { id }) => {
      await ctx.db.deleteFrom("project_template").where("id", "=", id).where("workspace_id", "=", ctx.workspaceId).execute();
      return { ok: true };
    },
  }),
  route({
    name: "getProjectStats",
    method: "GET",
    path: "/projects/:projectId/stats",
    description: "Aggregates for dashboards: tickets by status / priority / assignee / type / epic and recent created-vs-completed counts.",
    request: z.object({ projectId: z.string() }),
    response: anyObject,
    handler: async (ctx, { projectId }) => {
      const p = await resolveProject(ctx, projectId);
      const base = () => ctx.db.selectFrom("ticket").where("ticket.project_id", "=", p.id).where("ticket.archived_at", "is", null);
      const group = async (col: string) =>
        (await base().select([col as any]).select((eb) => eb.fn.countAll().as("count")).groupBy(col as any).execute()).map((r: any) => ({ key: r[col.split(".").pop()!], count: Number(r.count) }));
      const [byStatus, byPriority, byAssignee, byType, byEpic, byMilestone] = await Promise.all([
        group("ticket.status_id"), group("ticket.priority"), group("ticket.assignee_user_id"), group("ticket.type_id"), group("ticket.epic_id"), group("ticket.milestone_id"),
      ]);
      const since = new Date(Date.now() - 28 * 864e5);
      const created = await base().select((eb) => [eb.fn.countAll().as("c")]).where("ticket.created_at", ">=", since).executeTakeFirst();
      const doneRows = await ctx.db
        .selectFrom("ticket").innerJoin("status", "status.id", "ticket.status_id")
        .select((eb) => eb.fn.countAll().as("c"))
        .where("ticket.project_id", "=", p.id).where("status.category", "=", "done").where("ticket.updated_at", ">=", since)
        .executeTakeFirst();
      const overdue = await ctx.db
        .selectFrom("ticket").innerJoin("status", "status.id", "ticket.status_id")
        .select((eb) => eb.fn.countAll().as("c"))
        .where("ticket.project_id", "=", p.id).where("ticket.archived_at", "is", null).where("status.category", "in", ["backlog", "todo", "in_progress"]).where("ticket.due_date", "<", new Date())
        .executeTakeFirst();
      return { byStatus, byPriority, byAssignee, byType, byEpic, byMilestone, createdLast28d: Number(created?.c ?? 0), completedLast28d: Number(doneRows?.c ?? 0), overdue: Number(overdue?.c ?? 0) };
    },
  }),
];
