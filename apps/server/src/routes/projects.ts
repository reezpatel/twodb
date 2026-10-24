import { Hono } from "hono";
import { sql } from "kysely";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { allocateTicketNumber, defaultStatusFor, seedDefaultStatuses, statusesForSubproject, wouldCreateDependencyCycle } from "../lib/projects";
import type { ProjectTable, TicketTable } from "../plugins/db";

/** Projects app — Linear-like tracking. Projects are config containers; tickets
 * live in subprojects. Identifiers are `${project.key}-${number}` per project. */

type Ctx = { organizationId: string; userId: string };

async function ctxOf(c: { req: { raw: { headers: Headers }; header: (n: string) => string | undefined } }): Promise<Ctx | null> {
  const s = await requireOrgSession(c as never);
  if (!s) return null;
  return { organizationId: s.organizationId, userId: s.session?.user.id ?? "" };
}

async function projectFor(organizationId: string, projectId: string) {
  return db.selectFrom("project").selectAll().where("id", "=", projectId).where("organizationId", "=", organizationId).executeTakeFirst();
}

async function memberRole(projectId: string, userId: string) {
  const m = await db.selectFrom("project_member").select("role").where("projectId", "=", projectId).where("userId", "=", userId).executeTakeFirst();
  return m?.role ?? null;
}

/** Creator is owner; org admins get owner too. Non-members can read (org-visible)
 * but only members write. */
async function canWrite(ctx: Ctx, projectId: string) {
  const role = await memberRole(projectId, ctx.userId);
  return role !== null;
}

const id = () => crypto.randomUUID();
const now = () => new Date();

function ticketOut(t: TicketTable, projectKey: string, extra: Record<string, unknown> = {}) {
  return { ...t, identifier: `${projectKey}-${t.number}`, ...extra };
}

export const projectsRoutes = new Hono()
  // ----- projects -----------------------------------------------------------
  .get("/projects", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const projects = await db.selectFrom("project").selectAll().where("organizationId", "=", ctx.organizationId).orderBy("name").execute();
    const counts = await db
      .selectFrom("ticket")
      .select(["projectId", sql<number>`count(*)`.as("n"), sql<number>`count(*) filter (where "deletedAt" is null)`.as("active")])
      .where("organizationId", "=", ctx.organizationId)
      .groupBy("projectId")
      .execute();
    const byId = new Map(counts.map((r) => [r.projectId, r]));
    return c.json({ projects: projects.map((p) => ({ ...p, ticketCount: Number(byId.get(p.id)?.active ?? 0) })) });
  })

  .post("/projects", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const body = (await c.req.json()) as { name?: string; key?: string; description?: string; icon?: string; color?: string };
    const name = (body.name ?? "").trim();
    const key = (body.key ?? "").trim().toUpperCase();
    if (!name || !/^[A-Z][A-Z0-9]{1,9}$/.test(key))
      return c.json({ error: "name required; key must be 2-10 uppercase letters/digits starting with a letter" }, 400);
    const exists = await db.selectFrom("project").select("id").where("organizationId", "=", ctx.organizationId).where("key", "=", key).executeTakeFirst();
    if (exists) return c.json({ error: "key already used by another project" }, 409);
    const projectId = id();
    await db
      .insertInto("project")
      .values({
        id: projectId,
        organizationId: ctx.organizationId,
        spaceId: null,
        name,
        key,
        description: body.description ?? "",
        icon: body.icon ?? null,
        color: body.color ?? null,
        nextTicketNumber: 1,
        externalSource: null,
        externalRef: null,
        syncFilter: null,
        lastSyncAt: null,
        createdAt: now(),
        updatedAt: now(),
      })
      .execute();
    await db.insertInto("project_member").values({ projectId, userId: ctx.userId, role: "owner", createdAt: now() }).execute();
    await db
      .insertInto("subproject")
      .values({ id: id(), projectId, name: "General", description: "", position: 0, createdAt: now(), updatedAt: now() })
      .execute();
    await seedDefaultStatuses(projectId);
    const project = (await projectFor(ctx.organizationId, projectId))!;
    return c.json({ project }, 201);
  })

  .get("/projects/:projectId", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project) return c.json({ error: "project_not_found" }, 404);
    const subprojects = await db.selectFrom("subproject").selectAll().where("projectId", "=", project.id).orderBy("position").execute();
    const statuses = await db.selectFrom("project_status").selectAll().where("projectId", "=", project.id).orderBy("position").execute();
    const labelGroups = await db.selectFrom("label_group").selectAll().where("projectId", "=", project.id).orderBy("position").execute();
    const labels = await db.selectFrom("label").selectAll().where("projectId", "=", project.id).execute();
    const tags = await db.selectFrom("project_tag").selectAll().where("projectId", "=", project.id).execute();
    const milestones = await db.selectFrom("milestone").selectAll().where("projectId", "=", project.id).orderBy("position").execute();
    const sprints = await db.selectFrom("sprint").selectAll().where("projectId", "=", project.id).orderBy("createdAt").execute();
    const members = await db
      .selectFrom("project_member")
      .innerJoin("user", "user.id", "project_member.userId")
      .select(["project_member.userId", "project_member.role", "user.name", "user.email", "user.image"])
      .where("project_member.projectId", "=", project.id)
      .execute();
    const links = await db
      .selectFrom("project_link")
      .innerJoin("project as lp", "lp.id", "project_link.linkedProjectId")
      .select(["project_link.linkedProjectId", "lp.name as linkedName", "lp.key as linkedKey"])
      .where("project_link.projectId", "=", project.id)
      .execute();
    const role = await memberRole(project.id, ctx.userId);
    return c.json({ project, subprojects, statuses, labelGroups, labels, tags, milestones, sprints, members, links, myRole: role });
  })

  .patch("/projects/:projectId", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project) return c.json({ error: "project_not_found" }, 404);
    if (!(await canWrite(ctx, project.id))) return c.json({ error: "not_a_member" }, 403);
    const body = (await c.req.json()) as Partial<Pick<ProjectTable, "name" | "description" | "icon" | "color">>;
    await db
      .updateTable("project")
      .set({
        ...(body.name !== undefined ? { name: body.name.trim() || project.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.icon !== undefined ? { icon: body.icon } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        updatedAt: now(),
      })
      .where("id", "=", project.id)
      .execute();
    return c.json({ project: (await projectFor(ctx.organizationId, project.id))! });
  })

  .delete("/projects/:projectId", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project) return c.json({ error: "project_not_found" }, 404);
    const role = await memberRole(project.id, ctx.userId);
    if (role !== "owner") return c.json({ error: "owner_only" }, 403);
    await db.deleteFrom("project").where("id", "=", project.id).execute();
    return c.json({ ok: true });
  })

  // ----- subprojects ---------------------------------------------------------
  .post("/projects/:projectId/subprojects", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project) return c.json({ error: "project_not_found" }, 404);
    if (!(await canWrite(ctx, project.id))) return c.json({ error: "not_a_member" }, 403);
    const body = (await c.req.json()) as { name?: string };
    const name = (body.name ?? "").trim();
    if (!name) return c.json({ error: "name required" }, 400);
    const max = await db
      .selectFrom("subproject")
      .select(sql<number>`coalesce(max(position), 0)`.as("m"))
      .where("projectId", "=", project.id)
      .executeTakeFirst();
    const sub = { id: id(), projectId: project.id, name, description: "", position: (max?.m ?? 0) + 1, createdAt: now(), updatedAt: now() };
    await db.insertInto("subproject").values(sub).execute();
    return c.json({ subproject: sub }, 201);
  })

  .patch("/subprojects/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const sub = await db.selectFrom("subproject").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!sub) return c.json({ error: "not_found" }, 404);
    const project = await projectFor(ctx.organizationId, sub.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { name?: string; description?: string };
    await db
      .updateTable("subproject")
      .set({
        ...(body.name !== undefined ? { name: body.name.trim() || sub.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        updatedAt: now(),
      })
      .where("id", "=", sub.id)
      .execute();
    return c.json({ subproject: await db.selectFrom("subproject").selectAll().where("id", "=", sub.id).executeTakeFirst() });
  })

  .delete("/subprojects/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const sub = await db.selectFrom("subproject").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!sub) return c.json({ error: "not_found" }, 404);
    const project = await projectFor(ctx.organizationId, sub.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const count = await db
      .selectFrom("subproject")
      .select(sql<number>`count(*)`.as("n"))
      .where("projectId", "=", project.id)
      .executeTakeFirst();
    if (Number(count?.n ?? 0) <= 1) return c.json({ error: "project must keep at least one subproject" }, 409);
    // Move tickets to the first remaining subproject.
    const target = await db
      .selectFrom("subproject")
      .select("id")
      .where("projectId", "=", project.id)
      .where("id", "!=", sub.id)
      .orderBy("position")
      .executeTakeFirst();
    await db.updateTable("ticket").set({ subprojectId: target!.id, updatedAt: now() }).where("subprojectId", "=", sub.id).execute();
    await db.deleteFrom("project_status").where("subprojectId", "=", sub.id).execute();
    await db.deleteFrom("subproject").where("id", "=", sub.id).execute();
    return c.json({ ok: true, movedTo: target!.id });
  });

// Chained onto projectsRoutes — statuses, labels, tags, milestones, sprints.
export const projectsConfigRoutes = projectsRoutes
  // ----- statuses ------------------------------------------------------------
  .post("/projects/:projectId/statuses", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project) return c.json({ error: "project_not_found" }, 404);
    if (!(await canWrite(ctx, project.id))) return c.json({ error: "not_a_member" }, 403);
    const body = (await c.req.json()) as { name?: string; color?: string; category?: string; subprojectId?: string };
    const name = (body.name ?? "").trim();
    const category = body.category ?? "todo";
    if (!name || !["backlog", "todo", "in_progress", "done", "canceled"].includes(category)) return c.json({ error: "name + valid category required" }, 400);
    const max = await db
      .selectFrom("project_status")
      .select(sql<number>`coalesce(max(position), 0)`.as("m"))
      .where("projectId", "=", project.id)
      .where("subprojectId", body.subprojectId ? "=" : "is", body.subprojectId ?? null)
      .executeTakeFirst();
    const row = {
      id: id(),
      projectId: project.id,
      subprojectId: body.subprojectId ?? null,
      name,
      color: body.color ?? "#888888",
      category: category as never,
      position: (max?.m ?? 0) + 1,
      editable: "yes" as const,
      createdAt: now(),
    };
    await db.insertInto("project_status").values(row).execute();
    return c.json({ status: row }, 201);
  })

  .patch("/statuses/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const status = await db.selectFrom("project_status").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!status) return c.json({ error: "not_found" }, 404);
    if (status.editable === "sync") return c.json({ error: "status locked — managed by sync" }, 409);
    const project = await projectFor(ctx.organizationId, status.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { name?: string; color?: string; position?: number };
    await db
      .updateTable("project_status")
      .set({
        ...(body.name !== undefined ? { name: body.name.trim() || status.name } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
      })
      .where("id", "=", status.id)
      .execute();
    return c.json({ status: await db.selectFrom("project_status").selectAll().where("id", "=", status.id).executeTakeFirst() });
  })

  .delete("/statuses/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const status = await db.selectFrom("project_status").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!status) return c.json({ error: "not_found" }, 404);
    if (status.editable === "sync") return c.json({ error: "status locked — managed by sync" }, 409);
    const project = await projectFor(ctx.organizationId, status.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const inUse = await db
      .selectFrom("ticket")
      .select(sql<number>`count(*)`.as("n"))
      .where("statusId", "=", status.id)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (Number(inUse?.n ?? 0) > 0) return c.json({ error: "status in use by tickets" }, 409);
    await db.deleteFrom("project_status").where("id", "=", status.id).execute();
    return c.json({ ok: true });
  })

  // ----- labels / groups / tags -----------------------------------------------
  .post("/projects/:projectId/label-groups", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { name?: string };
    if (!body.name?.trim()) return c.json({ error: "name required" }, 400);
    const row = { id: id(), projectId: project.id, name: body.name.trim(), position: 0 };
    await db.insertInto("label_group").values(row).execute();
    return c.json({ group: row }, 201);
  })

  .post("/projects/:projectId/labels", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { name?: string; color?: string; groupId?: string };
    if (!body.name?.trim()) return c.json({ error: "name required" }, 400);
    const row = {
      id: id(),
      projectId: project.id,
      groupId: body.groupId ?? null,
      name: body.name.trim(),
      color: body.color ?? "#888888",
      editable: "yes" as const,
      externalRef: null,
    };
    await db.insertInto("label").values(row).execute();
    return c.json({ label: row }, 201);
  })

  .patch("/labels/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const label = await db.selectFrom("label").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!label) return c.json({ error: "not_found" }, 404);
    if (label.editable === "sync") return c.json({ error: "label locked — managed by sync" }, 409);
    const project = await projectFor(ctx.organizationId, label.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { name?: string; color?: string; groupId?: string | null };
    await db
      .updateTable("label")
      .set({
        ...(body.name !== undefined ? { name: body.name.trim() || label.name } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.groupId !== undefined ? { groupId: body.groupId } : {}),
      })
      .where("id", "=", label.id)
      .execute();
    return c.json({ label: await db.selectFrom("label").selectAll().where("id", "=", label.id).executeTakeFirst() });
  })

  .delete("/labels/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const label = await db.selectFrom("label").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!label) return c.json({ error: "not_found" }, 404);
    if (label.editable === "sync") return c.json({ error: "label locked — managed by sync" }, 409);
    const project = await projectFor(ctx.organizationId, label.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    await db.deleteFrom("label").where("id", "=", label.id).execute();
    return c.json({ ok: true });
  })

  .post("/projects/:projectId/tags", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { name?: string; color?: string };
    if (!body.name?.trim()) return c.json({ error: "name required" }, 400);
    const row = { id: id(), projectId: project.id, name: body.name.trim(), color: body.color ?? "#888888" };
    await db.insertInto("project_tag").values(row).execute();
    return c.json({ tag: row }, 201);
  })

  .delete("/tags/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const tag = await db.selectFrom("project_tag").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!tag) return c.json({ error: "not_found" }, 404);
    const project = await projectFor(ctx.organizationId, tag.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    await db.deleteFrom("project_tag").where("id", "=", tag.id).execute();
    return c.json({ ok: true });
  })

  // ----- milestones -------------------------------------------------------------
  .post("/projects/:projectId/milestones", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { name?: string; description?: string; targetDate?: string };
    if (!body.name?.trim()) return c.json({ error: "name required" }, 400);
    const row = {
      id: id(),
      projectId: project.id,
      name: body.name.trim(),
      description: body.description ?? "",
      targetDate: body.targetDate ?? null,
      status: "open" as const,
      position: 0,
      createdAt: now(),
    };
    await db.insertInto("milestone").values(row).execute();
    return c.json({ milestone: row }, 201);
  })

  .patch("/milestones/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const ms = await db.selectFrom("milestone").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!ms) return c.json({ error: "not_found" }, 404);
    const project = await projectFor(ctx.organizationId, ms.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { name?: string; description?: string; targetDate?: string | null; status?: "open" | "closed" };
    await db
      .updateTable("milestone")
      .set({
        ...(body.name !== undefined ? { name: body.name.trim() || ms.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.targetDate !== undefined ? { targetDate: body.targetDate } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      })
      .where("id", "=", ms.id)
      .execute();
    return c.json({ milestone: await db.selectFrom("milestone").selectAll().where("id", "=", ms.id).executeTakeFirst() });
  })

  .delete("/milestones/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const ms = await db.selectFrom("milestone").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!ms) return c.json({ error: "not_found" }, 404);
    const project = await projectFor(ctx.organizationId, ms.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    await db.deleteFrom("milestone").where("id", "=", ms.id).execute();
    return c.json({ ok: true });
  })

  // ----- sprints ------------------------------------------------------------------
  .post("/projects/:projectId/sprints", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { name?: string; startDate?: string; endDate?: string };
    if (!body.name?.trim()) return c.json({ error: "name required" }, 400);
    const row = {
      id: id(),
      projectId: project.id,
      name: body.name.trim(),
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      status: "planned" as const,
      completedPoints: null,
      createdAt: now(),
    };
    await db.insertInto("sprint").values(row).execute();
    return c.json({ sprint: row }, 201);
  })

  .patch("/sprints/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const sprint = await db.selectFrom("sprint").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!sprint) return c.json({ error: "not_found" }, 404);
    const project = await projectFor(ctx.organizationId, sprint.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { name?: string; startDate?: string | null; endDate?: string | null; status?: "planned" | "active" | "closed" };
    // Closing snapshots velocity: points of tickets in this sprint in a done status.
    let completedPoints: number | null = sprint.completedPoints;
    if (body.status === "closed" && sprint.status !== "closed") {
      const doneStatuses = await db.selectFrom("project_status").select("id").where("projectId", "=", project.id).where("category", "=", "done").execute();
      const doneIds = doneStatuses.map((s) => s.id);
      const pts = await db
        .selectFrom("ticket")
        .select(sql<number>`coalesce(sum(estimate), 0)`.as("p"))
        .where("sprintId", "=", sprint.id)
        .where("deletedAt", "is", null)
        .where("statusId", "in", doneIds.length ? doneIds : ["__none__"])
        .executeTakeFirst();
      completedPoints = Number(pts?.p ?? 0);
    }
    await db
      .updateTable("sprint")
      .set({
        ...(body.name !== undefined ? { name: body.name.trim() || sprint.name } : {}),
        ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
        ...(body.endDate !== undefined ? { endDate: body.endDate } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        completedPoints,
      })
      .where("id", "=", sprint.id)
      .execute();
    return c.json({ sprint: await db.selectFrom("sprint").selectAll().where("id", "=", sprint.id).executeTakeFirst() });
  })

  .delete("/sprints/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const sprint = await db.selectFrom("sprint").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!sprint) return c.json({ error: "not_found" }, 404);
    const project = await projectFor(ctx.organizationId, sprint.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    await db.deleteFrom("sprint").where("id", "=", sprint.id).execute();
    return c.json({ ok: true });
  })

  /** Velocity: per-sprint planned vs completed points. */
  .get("/projects/:projectId/velocity", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project) return c.json({ error: "project_not_found" }, 404);
    const sprints = await db.selectFrom("sprint").selectAll().where("projectId", "=", project.id).orderBy("createdAt").execute();
    const doneStatuses = await db.selectFrom("project_status").select("id").where("projectId", "=", project.id).where("category", "=", "done").execute();
    const doneIds = doneStatuses.map((s) => s.id);
    const rows = [];
    for (const s of sprints) {
      const planned = await db
        .selectFrom("ticket")
        .select(sql<number>`coalesce(sum(estimate), 0)`.as("p"))
        .where("sprintId", "=", s.id)
        .where("deletedAt", "is", null)
        .executeTakeFirst();
      const completed =
        s.status === "closed"
          ? (s.completedPoints ?? 0)
          : Number(
              (
                await db
                  .selectFrom("ticket")
                  .select(sql<number>`coalesce(sum(estimate), 0)`.as("p"))
                  .where("sprintId", "=", s.id)
                  .where("deletedAt", "is", null)
                  .where("statusId", "in", doneIds.length ? doneIds : ["__none__"])
                  .executeTakeFirst()
              )?.p ?? 0,
            );
      rows.push({ sprint: s, plannedPoints: Number(planned?.p ?? 0), completedPoints: completed });
    }
    return c.json({ velocity: rows });
  })

  // ----- project links ---------------------------------------------------------
  .post("/projects/:projectId/links", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { linkedProjectId?: string };
    const other = body.linkedProjectId ? await projectFor(ctx.organizationId, body.linkedProjectId) : null;
    if (!other) return c.json({ error: "linked project not found" }, 404);
    if (other.id === project.id) return c.json({ error: "cannot link a project to itself" }, 400);
    await db
      .insertInto("project_link")
      .values({ projectId: project.id, linkedProjectId: other.id, createdAt: now() })
      .onConflict((oc) => oc.doNothing())
      .execute();
    await db
      .insertInto("project_link")
      .values({ projectId: other.id, linkedProjectId: project.id, createdAt: now() })
      .onConflict((oc) => oc.doNothing())
      .execute();
    return c.json({ ok: true }, 201);
  })

  .delete("/projects/:projectId/links/:linkedId", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const linkedId = c.req.param("linkedId");
    await db.deleteFrom("project_link").where("projectId", "=", project.id).where("linkedProjectId", "=", linkedId).execute();
    await db.deleteFrom("project_link").where("projectId", "=", linkedId).where("linkedProjectId", "=", project.id).execute();
    return c.json({ ok: true });
  });

// Tickets: CRUD, move, subtasks, deps, comments, checklist, labels/tags.
export const ticketsRoutes = projectsConfigRoutes
  /** Board list: tickets of a project (optionally one subproject), with labels,
   * tags, assignee name, and blocker counts. */
  .get("/projects/:projectId/tickets", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project) return c.json({ error: "project_not_found" }, 404);
    const subprojectId = c.req.query("subprojectId");
    const sprintId = c.req.query("sprintId");
    const backlog = c.req.query("backlog");
    let q = db.selectFrom("ticket").selectAll().where("projectId", "=", project.id).where("deletedAt", "is", null);
    if (subprojectId) q = q.where("subprojectId", "=", subprojectId);
    if (sprintId) q = q.where("sprintId", "=", sprintId);
    if (backlog === "true") q = q.where("inBacklog", "=", true);
    const tickets = await q.orderBy("position").execute();
    if (!tickets.length) return c.json({ tickets: [] });
    const ticketIds = tickets.map((t) => t.id);
    const [labelRows, tagRows, depRows, statusRows] = await Promise.all([
      db
        .selectFrom("ticket_label")
        .innerJoin("label", "label.id", "ticket_label.labelId")
        .select(["ticket_label.ticketId", "label.id as labelId", "label.name", "label.color", "label.groupId"])
        .where("ticket_label.ticketId", "in", ticketIds)
        .execute(),
      db
        .selectFrom("ticket_tag")
        .innerJoin("project_tag", "project_tag.id", "ticket_tag.tagId")
        .select(["ticket_tag.ticketId", "project_tag.id as tagId", "project_tag.name", "project_tag.color"])
        .where("ticket_tag.ticketId", "in", ticketIds)
        .execute(),
      db.selectFrom("ticket_dependency").selectAll().where("ticketId", "in", ticketIds).execute(),
      db
        .selectFrom("project_status")
        .selectAll()
        .where("id", "in", [...new Set(tickets.map((t) => t.statusId))])
        .execute(),
    ]);
    const statusById = new Map(statusRows.map((s) => [s.id, s]));
    const assigneeIds = [...new Set(tickets.map((t) => t.assigneeUserId).filter((x): x is string => !!x))];
    const users = assigneeIds.length ? await db.selectFrom("user").select(["id", "name", "image"]).where("id", "in", assigneeIds).execute() : [];
    const userById = new Map(users.map((u) => [u.id, u]));
    return c.json({
      tickets: tickets.map((t) =>
        ticketOut(t, project.key, {
          labels: labelRows.filter((l) => l.ticketId === t.id).map((l) => ({ id: l.labelId, name: l.name, color: l.color, groupId: l.groupId })),
          tags: tagRows.filter((tg) => tg.ticketId === t.id).map((tg) => ({ id: tg.tagId, name: tg.name, color: tg.color })),
          assignee: t.assigneeUserId ? (userById.get(t.assigneeUserId) ?? null) : null,
          status: statusById.get(t.statusId) ?? null,
          blockedBy: depRows.filter((d) => d.ticketId === t.id).map((d) => d.dependsOnTicketId),
        }),
      ),
    });
  })

  .post("/projects/:projectId/tickets", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const project = await projectFor(ctx.organizationId, c.req.param("projectId"));
    if (!project) return c.json({ error: "project_not_found" }, 404);
    if (!(await canWrite(ctx, project.id))) return c.json({ error: "not_a_member" }, 403);
    const body = (await c.req.json()) as {
      title?: string;
      subprojectId?: string;
      description?: string;
      type?: string;
      statusId?: string;
      priority?: string;
      estimate?: number;
      parentTicketId?: string;
      epicId?: string;
      sprintId?: string;
      milestoneId?: string;
      assigneeUserId?: string;
      inBacklog?: boolean;
    };
    const title = (body.title ?? "").trim();
    if (!title) return c.json({ error: "title required" }, 400);
    const subprojectId =
      body.subprojectId ?? (await db.selectFrom("subproject").select("id").where("projectId", "=", project.id).orderBy("position").executeTakeFirst())?.id;
    if (!subprojectId) return c.json({ error: "no subproject" }, 400);
    const sub = await db.selectFrom("subproject").select("id").where("id", "=", subprojectId).where("projectId", "=", project.id).executeTakeFirst();
    if (!sub) return c.json({ error: "subproject not in project" }, 400);
    // Parent: one level deep — a subtask can't itself be a parent.
    if (body.parentTicketId) {
      const parent = await db.selectFrom("ticket").select(["id", "parentTicketId", "projectId"]).where("id", "=", body.parentTicketId).executeTakeFirst();
      if (!parent || parent.projectId !== project.id) return c.json({ error: "parent ticket not in project" }, 400);
      if (parent.parentTicketId) return c.json({ error: "subtasks are one level deep" }, 409);
    }
    if (body.epicId) {
      const epic = await db.selectFrom("ticket").select(["id", "type"]).where("id", "=", body.epicId).where("projectId", "=", project.id).executeTakeFirst();
      if (!epic || epic.type !== "epic") return c.json({ error: "epic must be a ticket of type epic in this project" }, 400);
    }
    const statuses = await statusesForSubproject(project.id, subprojectId);
    const status = body.statusId ? statuses.find((s) => s.id === body.statusId) : defaultStatusFor(statuses);
    if (!status) return c.json({ error: "no status available" }, 400);
    const number = await allocateTicketNumber(project.id);
    const ticketId = id();
    const ticket = {
      id: ticketId,
      organizationId: ctx.organizationId,
      projectId: project.id,
      subprojectId,
      number,
      title,
      description: body.description ?? "",
      type: (body.type ?? "issue") as never,
      statusId: status.id,
      priority: (body.priority ?? "none") as never,
      estimate: body.estimate ?? null,
      parentTicketId: body.parentTicketId ?? null,
      epicId: body.epicId ?? null,
      sprintId: body.sprintId ?? null,
      milestoneId: body.milestoneId ?? null,
      assigneeUserId: body.assigneeUserId ?? null,
      inBacklog: body.inBacklog ?? false,
      position: 0,
      externalRef: null,
      deletedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.insertInto("ticket").values(ticket).execute();
    return c.json({ ticket: ticketOut(ticket as TicketTable, project.key) }, 201);
  })

  /** Single ticket with everything: comments, checklist, deps, subtasks. */
  .get("/tickets/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const ticket = await db
      .selectFrom("ticket")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", ctx.organizationId)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (!ticket) return c.json({ error: "ticket_not_found" }, 404);
    const project = await projectFor(ctx.organizationId, ticket.projectId);
    const [comments, checklist, deps, blocking, subtasks, labels, tags] = await Promise.all([
      db
        .selectFrom("ticket_comment")
        .innerJoin("user", "user.id", "ticket_comment.userId")
        .select([
          "ticket_comment.id",
          "ticket_comment.body",
          "ticket_comment.createdAt",
          "ticket_comment.updatedAt",
          "user.id as userId",
          "user.name as userName",
          "user.image as userImage",
        ])
        .where("ticket_comment.ticketId", "=", ticket.id)
        .orderBy("ticket_comment.createdAt")
        .execute(),
      db.selectFrom("ticket_checklist_item").selectAll().where("ticketId", "=", ticket.id).orderBy("position").execute(),
      db.selectFrom("ticket_dependency").selectAll().where("ticketId", "=", ticket.id).execute(),
      db.selectFrom("ticket_dependency").selectAll().where("dependsOnTicketId", "=", ticket.id).execute(),
      db
        .selectFrom("ticket")
        .select(["id", "number", "title", "statusId", "type"])
        .where("parentTicketId", "=", ticket.id)
        .where("deletedAt", "is", null)
        .execute(),
      db
        .selectFrom("ticket_label")
        .innerJoin("label", "label.id", "ticket_label.labelId")
        .select(["label.id", "label.name", "label.color", "label.groupId"])
        .where("ticket_label.ticketId", "=", ticket.id)
        .execute(),
      db
        .selectFrom("ticket_tag")
        .innerJoin("project_tag", "project_tag.id", "ticket_tag.tagId")
        .select(["project_tag.id", "project_tag.name", "project_tag.color"])
        .where("ticket_tag.ticketId", "=", ticket.id)
        .execute(),
    ]);
    const depIds = [...deps.map((d) => d.dependsOnTicketId), ...blocking.map((d) => d.ticketId)];
    const depTickets = depIds.length ? await db.selectFrom("ticket").select(["id", "number", "title", "statusId"]).where("id", "in", depIds).execute() : [];
    const depById = new Map(depTickets.map((t) => [t.id, t]));
    return c.json({
      ticket: ticketOut(ticket, project!.key, {
        comments,
        checklist,
        labels,
        tags,
        subtasks: subtasks.map((s) => ({ ...s, identifier: `${project!.key}-${s.number}` })),
        blockedBy: deps.map((d) => ({
          id: d.dependsOnTicketId,
          identifier: depById.has(d.dependsOnTicketId) ? `${project!.key}-${depById.get(d.dependsOnTicketId)!.number}` : "?",
          title: depById.get(d.dependsOnTicketId)?.title ?? "",
        })),
        blocks: blocking.map((d) => ({
          id: d.ticketId,
          identifier: depById.has(d.ticketId) ? `${project!.key}-${depById.get(d.ticketId)!.number}` : "?",
          title: depById.get(d.ticketId)?.title ?? "",
        })),
      }),
    });
  })

  .patch("/tickets/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const ticket = await db
      .selectFrom("ticket")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", ctx.organizationId)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (!ticket) return c.json({ error: "ticket_not_found" }, 404);
    const project = await projectFor(ctx.organizationId, ticket.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as Partial<TicketTable> & { labelIds?: string[]; tagIds?: string[] };
    if (body.type === "epic" && body.epicId) return c.json({ error: "an epic can't belong to another epic" }, 400);
    if (body.epicId) {
      const epic = await db.selectFrom("ticket").select(["id", "type"]).where("id", "=", body.epicId).where("projectId", "=", project.id).executeTakeFirst();
      if (!epic || epic.type !== "epic") return c.json({ error: "epic must be a ticket of type epic" }, 400);
    }
    if (body.statusId) {
      const status = await db.selectFrom("project_status").select("id").where("id", "=", body.statusId).where("projectId", "=", project.id).executeTakeFirst();
      if (!status) return c.json({ error: "status not in project" }, 400);
    }
    if (body.subprojectId && body.subprojectId !== ticket.subprojectId) {
      const sub = await db.selectFrom("subproject").select("id").where("id", "=", body.subprojectId).where("projectId", "=", project.id).executeTakeFirst();
      if (!sub) return c.json({ error: "subproject not in project" }, 400);
      // Current status may not exist in the target's override set — remap to its default.
      const statuses = await statusesForSubproject(project.id, body.subprojectId);
      if (!statuses.some((s) => s.id === (body.statusId ?? ticket.statusId))) {
        body.statusId = defaultStatusFor(statuses)?.id;
      }
    }
    const patch: Record<string, unknown> = { updatedAt: now() };
    for (const k of [
      "title",
      "description",
      "type",
      "statusId",
      "priority",
      "estimate",
      "parentTicketId",
      "epicId",
      "sprintId",
      "milestoneId",
      "assigneeUserId",
      "inBacklog",
      "position",
      "subprojectId",
    ] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    await db.updateTable("ticket").set(patch).where("id", "=", ticket.id).execute();
    if (body.labelIds) {
      await db.deleteFrom("ticket_label").where("ticketId", "=", ticket.id).execute();
      if (body.labelIds.length)
        await db
          .insertInto("ticket_label")
          .values(body.labelIds.map((labelId) => ({ ticketId: ticket.id, labelId })))
          .execute();
    }
    if (body.tagIds) {
      await db.deleteFrom("ticket_tag").where("ticketId", "=", ticket.id).execute();
      if (body.tagIds.length)
        await db
          .insertInto("ticket_tag")
          .values(body.tagIds.map((tagId) => ({ ticketId: ticket.id, tagId })))
          .execute();
    }
    const updated = (await db.selectFrom("ticket").selectAll().where("id", "=", ticket.id).executeTakeFirst())!;
    return c.json({ ticket: ticketOut(updated, project.key) });
  })

  .delete("/tickets/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const ticket = await db
      .selectFrom("ticket")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", ctx.organizationId)
      .where("deletedAt", "is", null)
      .executeTakeFirst();
    if (!ticket) return c.json({ error: "ticket_not_found" }, 404);
    const project = await projectFor(ctx.organizationId, ticket.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    await db.updateTable("ticket").set({ deletedAt: now(), updatedAt: now() }).where("id", "=", ticket.id).execute();
    return c.json({ ok: true });
  })

  // ----- dependencies ---------------------------------------------------------
  .post("/tickets/:id/dependencies", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const ticket = await db
      .selectFrom("ticket")
      .selectAll()
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", ctx.organizationId)
      .executeTakeFirst();
    if (!ticket) return c.json({ error: "ticket_not_found" }, 404);
    const project = await projectFor(ctx.organizationId, ticket.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { dependsOnTicketId?: string };
    if (!body.dependsOnTicketId || body.dependsOnTicketId === ticket.id) return c.json({ error: "dependsOnTicketId required (and not self)" }, 400);
    const other = await db.selectFrom("ticket").select(["id", "projectId"]).where("id", "=", body.dependsOnTicketId).executeTakeFirst();
    if (!other || other.projectId !== project.id) return c.json({ error: "dependency must be in the same project" }, 400);
    if (await wouldCreateDependencyCycle(ticket.id, other.id)) return c.json({ error: "would create a dependency cycle" }, 409);
    await db
      .insertInto("ticket_dependency")
      .values({ ticketId: ticket.id, dependsOnTicketId: other.id, createdAt: now() })
      .onConflict((oc) => oc.doNothing())
      .execute();
    return c.json({ ok: true }, 201);
  })

  .delete("/tickets/:id/dependencies/:depId", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const ticket = await db
      .selectFrom("ticket")
      .select(["id", "projectId"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", ctx.organizationId)
      .executeTakeFirst();
    if (!ticket) return c.json({ error: "ticket_not_found" }, 404);
    const project = await projectFor(ctx.organizationId, ticket.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    await db.deleteFrom("ticket_dependency").where("ticketId", "=", ticket.id).where("dependsOnTicketId", "=", c.req.param("depId")).execute();
    return c.json({ ok: true });
  })

  // ----- comments -------------------------------------------------------------
  .post("/tickets/:id/comments", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const ticket = await db
      .selectFrom("ticket")
      .select(["id", "projectId"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", ctx.organizationId)
      .executeTakeFirst();
    if (!ticket) return c.json({ error: "ticket_not_found" }, 404);
    const project = await projectFor(ctx.organizationId, ticket.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { body?: string };
    if (!body.body?.trim()) return c.json({ error: "body required" }, 400);
    const row = { id: id(), ticketId: ticket.id, userId: ctx.userId, body: body.body.trim(), createdAt: now(), updatedAt: now() };
    await db.insertInto("ticket_comment").values(row).execute();
    return c.json({ comment: row }, 201);
  })

  .patch("/comments/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const comment = await db.selectFrom("ticket_comment").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!comment || comment.userId !== ctx.userId) return c.json({ error: "not_found" }, 404);
    const body = (await c.req.json()) as { body?: string };
    if (!body.body?.trim()) return c.json({ error: "body required" }, 400);
    await db.updateTable("ticket_comment").set({ body: body.body.trim(), updatedAt: now() }).where("id", "=", comment.id).execute();
    return c.json({ comment: await db.selectFrom("ticket_comment").selectAll().where("id", "=", comment.id).executeTakeFirst() });
  })

  .delete("/comments/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const comment = await db.selectFrom("ticket_comment").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!comment || comment.userId !== ctx.userId) return c.json({ error: "not_found" }, 404);
    await db.deleteFrom("ticket_comment").where("id", "=", comment.id).execute();
    return c.json({ ok: true });
  })

  // ----- checklist -------------------------------------------------------------
  .post("/tickets/:id/checklist", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const ticket = await db
      .selectFrom("ticket")
      .select(["id", "projectId"])
      .where("id", "=", c.req.param("id"))
      .where("organizationId", "=", ctx.organizationId)
      .executeTakeFirst();
    if (!ticket) return c.json({ error: "ticket_not_found" }, 404);
    const project = await projectFor(ctx.organizationId, ticket.projectId);
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { text?: string; parentItemId?: string };
    if (!body.text?.trim()) return c.json({ error: "text required" }, 400);
    if (body.parentItemId) {
      const parent = await db
        .selectFrom("ticket_checklist_item")
        .select(["id", "parentItemId"])
        .where("id", "=", body.parentItemId)
        .where("ticketId", "=", ticket.id)
        .executeTakeFirst();
      if (!parent) return c.json({ error: "parent item not found" }, 404);
      if (parent.parentItemId) return c.json({ error: "checklist nesting is one level deep" }, 409);
    }
    const max = await db
      .selectFrom("ticket_checklist_item")
      .select(sql<number>`coalesce(max(position), 0)`.as("m"))
      .where("ticketId", "=", ticket.id)
      .executeTakeFirst();
    const row = {
      id: id(),
      ticketId: ticket.id,
      parentItemId: body.parentItemId ?? null,
      text: body.text.trim(),
      done: false,
      position: (max?.m ?? 0) + 1,
      createdAt: now(),
    };
    await db.insertInto("ticket_checklist_item").values(row).execute();
    return c.json({ item: row }, 201);
  })

  .patch("/checklist/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const item = await db.selectFrom("ticket_checklist_item").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!item) return c.json({ error: "not_found" }, 404);
    const ticket = await db.selectFrom("ticket").select(["projectId"]).where("id", "=", item.ticketId).executeTakeFirst();
    const project = ticket ? await projectFor(ctx.organizationId, ticket.projectId) : null;
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json()) as { text?: string; done?: boolean; position?: number };
    await db
      .updateTable("ticket_checklist_item")
      .set({
        ...(body.text !== undefined ? { text: body.text.trim() || item.text } : {}),
        ...(body.done !== undefined ? { done: body.done } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
      })
      .where("id", "=", item.id)
      .execute();
    return c.json({ item: await db.selectFrom("ticket_checklist_item").selectAll().where("id", "=", item.id).executeTakeFirst() });
  })

  .delete("/checklist/:id", async (c) => {
    const ctx = await ctxOf(c);
    if (!ctx) return c.json({ error: "unauthorized" }, 401);
    const item = await db.selectFrom("ticket_checklist_item").selectAll().where("id", "=", c.req.param("id")).executeTakeFirst();
    if (!item) return c.json({ error: "not_found" }, 404);
    const ticket = await db.selectFrom("ticket").select(["projectId"]).where("id", "=", item.ticketId).executeTakeFirst();
    const project = ticket ? await projectFor(ctx.organizationId, ticket.projectId) : null;
    if (!project || !(await canWrite(ctx, project.id))) return c.json({ error: "forbidden" }, 403);
    await db.deleteFrom("ticket_checklist_item").where("id", "=", item.id).execute();
    return c.json({ ok: true });
  });
