import { Hono } from "hono";
import { db } from "../auth";
import { requireOrgSession } from "../lib/session";
import { allocateTicketNumber } from "../lib/projects";

/** One-way inbound sync from Linear / Plane. Linking creates the project and
 * copies its config (statuses, labels) locked (editable='sync'). Pull imports
 * tickets matching the filter; per-ticket push sends local edits back after a
 * diff preview. */

interface RemoteConfig {
  source: "linear" | "plane";
  apiKey: string;
  baseUrl?: string; // plane only
  /** Linear: team key; Plane: "workspace/projectId". */
  remoteProjectId: string;
}

async function linearGql(apiKey: string, query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`linear returned ${res.status}`);
  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data!;
}

interface RemoteTicket {
  externalId: string;
  title: string;
  description: string;
  status: string;
  priority: number; // linear scale 0-4
  labels: string[];
  url: string;
}

const LINEAR_PRIORITY = ["none", "urgent", "high", "medium", "low"] as const;

async function linearFetchTickets(cfg: RemoteConfig): Promise<RemoteTicket[]> {
  const data = await linearGql(
    cfg.apiKey,
    `query($key: String!) { team(id: $key) { issues(first: 100) { nodes { id title description priority url state { name } labels { nodes { name } } } } } }`,
    { key: cfg.remoteProjectId },
  );
  const team = data.team as {
    issues: {
      nodes: {
        id: string;
        title: string;
        description: string | null;
        priority: number;
        url: string;
        state: { name: string } | null;
        labels: { nodes: { name: string }[] };
      }[];
    };
  } | null;
  if (!team) throw new Error("team not found");
  return team.issues.nodes.map((n) => ({
    externalId: n.id,
    title: n.title,
    description: n.description ?? "",
    status: n.state?.name ?? "Todo",
    priority: n.priority,
    labels: n.labels.nodes.map((l) => l.name),
    url: n.url,
  }));
}

async function planeFetchTickets(cfg: RemoteConfig): Promise<RemoteTicket[]> {
  const [workspace, projectId] = cfg.remoteProjectId.split("/");
  const base = (cfg.baseUrl ?? "").replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1/workspaces/${workspace}/projects/${projectId}/issues/`, {
    headers: { "x-api-key": cfg.apiKey },
  });
  if (!res.ok) throw new Error(`plane returned ${res.status}`);
  const json = (await res.json()) as {
    results?: { id: string; name: string; description_html?: string; priority?: string; state_detail?: { name: string } }[];
  };
  return (json.results ?? []).map((n) => ({
    externalId: n.id,
    title: n.name,
    description: n.description_html ?? "",
    status: n.state_detail?.name ?? "Todo",
    priority: { none: 0, low: 4, medium: 3, high: 2, urgent: 1 }[n.priority ?? "none"] ?? 0,
    labels: [],
    url: `${base}/${workspace}/projects/${projectId}/issues/${n.id}`,
  }));
}

async function fetchRemoteTickets(cfg: RemoteConfig): Promise<RemoteTicket[]> {
  return cfg.source === "linear" ? linearFetchTickets(cfg) : planeFetchTickets(cfg);
}

function cfgOf(project: { externalSource: string | null; externalRef: Record<string, unknown> | null }): RemoteConfig | null {
  if (!project.externalSource || !project.externalRef) return null;
  const ref = project.externalRef as { apiKey?: string; baseUrl?: string; remoteProjectId?: string };
  if (!ref.apiKey || !ref.remoteProjectId) return null;
  return { source: project.externalSource as "linear" | "plane", apiKey: ref.apiKey, baseUrl: ref.baseUrl, remoteProjectId: ref.remoteProjectId };
}

export const projectsSyncRoutes = new Hono()
  /** Link: create a project from a remote Linear team / Plane project. */
  .post("/link", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const body = (await c.req.json()) as Partial<RemoteConfig> & { key?: string; name?: string };
    if (!body.source || !body.apiKey || !body.remoteProjectId) return c.json({ error: "source, apiKey, remoteProjectId required" }, 400);
    if (!["linear", "plane"].includes(body.source)) return c.json({ error: "source must be linear or plane" }, 400);
    const cfg: RemoteConfig = { source: body.source, apiKey: body.apiKey, baseUrl: body.baseUrl, remoteProjectId: body.remoteProjectId };

    let remote: RemoteTicket[];
    try {
      remote = await fetchRemoteTickets(cfg);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 502);
    }

    const key =
      (body.key ?? body.remoteProjectId.split("/").pop() ?? "EXT")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 10) || "EXT";
    const name = body.name?.trim() || `${cfg.source === "linear" ? "Linear" : "Plane"}: ${body.remoteProjectId}`;
    const projectId = crypto.randomUUID();
    const now = new Date();
    await db
      .insertInto("project")
      .values({
        id: projectId,
        organizationId: s.organizationId,
        spaceId: null,
        name,
        key,
        description: "",
        icon: null,
        color: null,
        nextTicketNumber: 1,
        externalSource: cfg.source,
        externalRef: { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl ?? null, remoteProjectId: cfg.remoteProjectId },
        syncFilter: null,
        lastSyncAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .execute();
    if (s.session) await db.insertInto("project_member").values({ projectId, userId: s.session.user.id, role: "owner", createdAt: now }).execute();
    const subId = crypto.randomUUID();
    await db.insertInto("subproject").values({ id: subId, projectId, name: "General", description: "", position: 0, createdAt: now, updatedAt: now }).execute();

    // Statuses: one per distinct remote state, locked.
    const stateNames = [...new Set(remote.map((t) => t.status))];
    const statusIdByName = new Map<string, string>();
    const CATEGORIES: Record<string, string> = { Backlog: "backlog", Todo: "todo", "In Progress": "in_progress", Done: "done", Canceled: "canceled" };
    for (const [i, state] of stateNames.entries()) {
      const sid = crypto.randomUUID();
      statusIdByName.set(state, sid);
      await db
        .insertInto("project_status")
        .values({
          id: sid,
          projectId,
          subprojectId: null,
          name: state,
          color: "#888888",
          category: (CATEGORIES[state] ?? "todo") as never,
          position: i,
          editable: "sync",
          createdAt: now,
        })
        .execute();
    }
    // Labels seen on tickets, locked.
    const labelIdByName = new Map<string, string>();
    for (const ln of new Set(remote.flatMap((t) => t.labels))) {
      const lid = crypto.randomUUID();
      labelIdByName.set(ln, lid);
      await db.insertInto("label").values({ id: lid, projectId, groupId: null, name: ln, color: "#888888", editable: "sync", externalRef: null }).execute();
    }

    // Tickets.
    for (const rt of remote) {
      const number = await allocateTicketNumber(projectId);
      const ticketId = crypto.randomUUID();
      await db
        .insertInto("ticket")
        .values({
          id: ticketId,
          organizationId: s.organizationId,
          projectId,
          subprojectId: subId,
          number,
          title: rt.title,
          description: rt.description,
          type: "issue",
          statusId: statusIdByName.get(rt.status)!,
          priority: (LINEAR_PRIORITY[rt.priority] ?? "none") as never,
          estimate: null,
          parentTicketId: null,
          epicId: null,
          sprintId: null,
          milestoneId: null,
          assigneeUserId: null,
          inBacklog: (CATEGORIES[rt.status] ?? "todo") === "backlog",
          position: 0,
          externalRef: { source: cfg.source, externalId: rt.externalId, externalUrl: rt.url },
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .execute();
      for (const ln of rt.labels) {
        await db
          .insertInto("ticket_label")
          .values({ ticketId, labelId: labelIdByName.get(ln)! })
          .execute();
      }
    }

    const project = await db.selectFrom("project").selectAll().where("id", "=", projectId).executeTakeFirst();
    return c.json({ project, imported: remote.length }, 201);
  })

  /** Pull: re-import remote tickets into an existing linked project. */
  .post("/:projectId/pull", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const project = await db
      .selectFrom("project")
      .selectAll()
      .where("id", "=", c.req.param("projectId"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!project) return c.json({ error: "project_not_found" }, 404);
    const cfg = cfgOf(project);
    if (!cfg) return c.json({ error: "project not linked" }, 400);
    let remote: RemoteTicket[];
    try {
      remote = await fetchRemoteTickets(cfg);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 502);
    }
    const existing = await db.selectFrom("ticket").select(["id", "externalRef"]).where("projectId", "=", project.id).execute();
    const byExternalId = new Map(existing.map((t) => [String((t.externalRef as { externalId?: string } | null)?.externalId), t.id]));
    const sub = await db.selectFrom("subproject").select("id").where("projectId", "=", project.id).orderBy("position").executeTakeFirst();
    const statuses = await db.selectFrom("project_status").selectAll().where("projectId", "=", project.id).execute();
    const statusByName = new Map(statuses.map((s) => [s.name, s.id]));
    const now = new Date();
    let created = 0;
    let updated = 0;
    for (const rt of remote) {
      const statusId = statusByName.get(rt.status) ?? statuses[0]?.id;
      if (!statusId) continue;
      const patch = { title: rt.title, description: rt.description, statusId, priority: (LINEAR_PRIORITY[rt.priority] ?? "none") as never, updatedAt: now };
      const existingId = byExternalId.get(rt.externalId);
      if (existingId) {
        await db.updateTable("ticket").set(patch).where("id", "=", existingId).execute();
        updated++;
      } else {
        const number = await allocateTicketNumber(project.id);
        await db
          .insertInto("ticket")
          .values({
            id: crypto.randomUUID(),
            organizationId: s.organizationId,
            projectId: project.id,
            subprojectId: sub!.id,
            number,
            ...patch,
            type: "issue",
            estimate: null,
            parentTicketId: null,
            epicId: null,
            sprintId: null,
            milestoneId: null,
            assigneeUserId: null,
            inBacklog: false,
            position: 0,
            externalRef: { source: cfg.source, externalId: rt.externalId, externalUrl: rt.url },
            deletedAt: null,
            createdAt: now,
          })
          .execute();
        created++;
      }
    }
    await db.updateTable("project").set({ lastSyncAt: now, updatedAt: now }).where("id", "=", project.id).execute();
    return c.json({ ok: true, created, updated });
  })

  /** Diff: what a push would change on the remote, field by field. */
  .get("/tickets/:ticketId/diff", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const ticket = await db
      .selectFrom("ticket")
      .selectAll()
      .where("id", "=", c.req.param("ticketId"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!ticket) return c.json({ error: "ticket_not_found" }, 404);
    const project = await db.selectFrom("project").selectAll().where("id", "=", ticket.projectId).executeTakeFirst();
    const cfg = project ? cfgOf(project) : null;
    if (!cfg || !ticket.externalRef) return c.json({ error: "ticket not synced" }, 400);
    const externalId = String((ticket.externalRef as { externalId?: string }).externalId);
    let remote: RemoteTicket[];
    try {
      remote = await fetchRemoteTickets(cfg);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 502);
    }
    const rt = remote.find((r) => r.externalId === externalId);
    if (!rt) return c.json({ error: "ticket no longer exists on the remote" }, 404);
    const status = await db.selectFrom("project_status").select("name").where("id", "=", ticket.statusId).executeTakeFirst();
    const changes: { field: string; local: string; remote: string }[] = [];
    if (ticket.title !== rt.title) changes.push({ field: "title", local: ticket.title, remote: rt.title });
    if ((ticket.description ?? "") !== rt.description)
      changes.push({ field: "description", local: (ticket.description ?? "").slice(0, 300), remote: rt.description.slice(0, 300) });
    if ((status?.name ?? "") !== rt.status) changes.push({ field: "status", local: status?.name ?? "", remote: rt.status });
    const localPriority = LINEAR_PRIORITY[rt.priority] ?? "none";
    if (ticket.priority !== localPriority) changes.push({ field: "priority", local: ticket.priority, remote: localPriority });
    return c.json({ changes });
  })

  /** Push: apply local field values to the remote. */
  .post("/tickets/:ticketId/push", async (c) => {
    const s = await requireOrgSession(c);
    if (!s) return c.json({ error: "unauthorized" }, 401);
    const ticket = await db
      .selectFrom("ticket")
      .selectAll()
      .where("id", "=", c.req.param("ticketId"))
      .where("organizationId", "=", s.organizationId)
      .executeTakeFirst();
    if (!ticket?.externalRef) return c.json({ error: "ticket not synced" }, 400);
    const project = await db.selectFrom("project").selectAll().where("id", "=", ticket.projectId).executeTakeFirst();
    const cfg = project ? cfgOf(project) : null;
    if (!cfg) return c.json({ error: "project not linked" }, 400);
    const externalId = String((ticket.externalRef as { externalId?: string }).externalId);
    const status = await db.selectFrom("project_status").select("name").where("id", "=", ticket.statusId).executeTakeFirst();
    const priorityNum = LINEAR_PRIORITY.indexOf(ticket.priority as never);
    try {
      if (cfg.source === "linear") {
        await linearGql(
          cfg.apiKey,
          `mutation($id: String!, $title: String, $description: String, $priority: Int) { issueUpdate(id: $id, input: { title: $title, description: $description, priority: $priority }) { success } }`,
          { id: externalId, title: ticket.title, description: ticket.description, priority: Math.max(0, priorityNum) },
        );
        void status; // status push needs a state id lookup — title/desc/priority only for now
      } else {
        const [workspace, projectId] = cfg.remoteProjectId.split("/");
        const base = (cfg.baseUrl ?? "").replace(/\/$/, "");
        const res = await fetch(`${base}/api/v1/workspaces/${workspace}/projects/${projectId}/issues/${externalId}/`, {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-api-key": cfg.apiKey },
          body: JSON.stringify({ name: ticket.title, description_html: ticket.description }),
        });
        if (!res.ok) throw new Error(`plane returned ${res.status}`);
      }
    } catch (e) {
      return c.json({ error: (e as Error).message }, 502);
    }
    return c.json({ ok: true });
  });
