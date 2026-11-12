import { z } from "zod";
import { ulid } from "ulid";
import { route, rawRoute, type Ctx, type RouteDef } from "../lib/route.js";
import { resolveProject } from "../lib/access.js";
import { badRequest } from "../lib/http.js";
import { hydrateTickets } from "../lib/tickets.js";
import { createTicketRow } from "./tickets-list-create.js";
import { applyTicketFilters, listFilters } from "./tickets-list-create.js";
import { PRIORITIES } from "../db/schema.js";

// ── CSV (RFC 4180) ───────────────────────────────────────────────────────
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x !== "")) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const COLUMNS = ["identifier", "title", "description", "status", "type", "priority", "assignee", "epic", "milestone", "labels", "points", "estimateMinutes", "startDate", "dueDate", "parent", "created"];

async function lookups(ctx: Ctx, projectId: string) {
  const [statuses, types, epics, milestones, labels] = await Promise.all(
    ["status", "ticket_type", "epic", "milestone", "label"].map((t) => ctx.db.selectFrom(t as any).selectAll().where("project_id", "=", projectId).execute()),
  );
  return { statuses: statuses as any[], types: types as any[], epics: epics as any[], milestones: milestones as any[], labels: labels as any[] };
}

const byName = (rows: any[], key: string, v: string | undefined | null) => (v ? rows.find((r) => String(r[key]).toLowerCase() === v.trim().toLowerCase()) : undefined);

export const importExportRoutes: RouteDef[] = [
  rawRoute({
    name: "exportTickets", method: "GET", path: "/projects/:projectId/export",
    description: "Exports a project's tickets (honouring the listTickets filters) as CSV (default) or JSON. Names, not ids, so the file round-trips through importTicketsCsv.",
    raw: async (ctx, req, reply) => {
      const p = await resolveProject(ctx, (req.params as any).projectId);
      const query = req.query as Record<string, string>;
      const f = listFilters.parse(query);
      const rows = await applyTicketFilters(ctx.db.selectFrom("ticket").innerJoin("status", "status.id", "ticket.status_id").where("ticket.project_id", "=", p.id), f, p.key).selectAll("ticket").orderBy("ticket.sequence_number").execute();
      const tickets = await hydrateTickets(ctx, p.key, rows);
      const L = await lookups(ctx, p.id);
      const name = (list: any[], id: string | null, key = "name") => list.find((x) => x.id === id)?.[key] ?? "";
      const byId = new Map(tickets.map((t: any) => [t.id, t.identifier]));
      const flat = tickets.map((t: any) => ({
        identifier: t.identifier, title: t.title, description: t.description, status: name(L.statuses, t.statusId), type: name(L.types, t.typeId), priority: t.priority ?? "",
        assignee: t.assigneeUserId ?? "", epic: name(L.epics, t.epicId, "title"), milestone: name(L.milestones, t.milestoneId),
        labels: t.labelIds.map((id: string) => name(L.labels, id)).join("|"), points: t.estimatePoints ?? "", estimateMinutes: t.estimateMinutes ?? "",
        startDate: t.startDate ?? "", dueDate: t.dueDate ?? "", parent: t.parentId ? byId.get(t.parentId) ?? "" : "", created: t.createdAt,
      }));
      if (query.format === "json") return reply.header("content-disposition", `attachment; filename="${p.key}.json"`).send(flat);
      const csv = [COLUMNS.join(","), ...flat.map((r: any) => COLUMNS.map((c) => esc(r[c])).join(","))].join("\n");
      return reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", `attachment; filename="${p.key}-tickets.csv"`).send(csv);
    },
  }),

  route({
    name: "importTicketsCsv", method: "POST", path: "/projects/:projectId/import/csv",
    description:
      "Imports tickets from CSV text. Header row required; recognised columns: title (required), description, status, type, priority, assignee, epic, milestone, labels (| separated), " +
      "points, estimateMinutes, startDate, dueDate. Status/type/epic/milestone are matched by name; unknown labels and epics are created. Rows that fail are reported, the rest import.",
    request: z.object({ projectId: z.string(), csv: z.string().min(1), createMissing: z.boolean().default(true) }),
    response: z.object({ imported: z.number(), failed: z.array(z.object({ row: z.number(), error: z.string() })) }),
    handler: async (ctx, { projectId, csv, createMissing }) => {
      const p = await resolveProject(ctx, projectId);
      const rows = parseCsv(csv);
      if (rows.length < 2) throw badRequest("CSV needs a header row and at least one data row");
      const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s_]/g, ""));
      const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
      const idx = { title: col("title", "summary", "name"), description: col("description", "body"), status: col("status", "state"), type: col("type", "issuetype"), priority: col("priority"), assignee: col("assignee"), epic: col("epic", "project"), milestone: col("milestone", "cycle", "sprint"), labels: col("labels", "tags"), points: col("points", "estimate", "storypoints"), minutes: col("estimateminutes"), start: col("startdate", "start"), due: col("duedate", "due") };
      if (idx.title < 0) throw badRequest("CSV must have a title column");
      const L = await lookups(ctx, p.id);
      const failed: { row: number; error: string }[] = [];
      let imported = 0;
      const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
      const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
      for (let n = 1; n < rows.length; n++) {
        const r = rows[n];
        try {
          const title = get(r, idx.title);
          if (!title) throw new Error("empty title");
          const pri = get(r, idx.priority).toLowerCase();
          let epic = byName(L.epics, "title", get(r, idx.epic));
          if (!epic && get(r, idx.epic) && createMissing) {
            epic = (await ctx.db.insertInto("epic").values({ id: ulid(), project_id: p.id, title: get(r, idx.epic), position: (L.epics.length + 1) * 1000 }).returningAll().executeTakeFirstOrThrow()) as any;
            L.epics.push(epic);
          }
          const labelIds: string[] = [];
          for (const name of get(r, idx.labels).split(/[|;]/).map((s) => s.trim()).filter(Boolean)) {
            let l = byName(L.labels, "name", name);
            if (!l && createMissing) { l = (await ctx.db.insertInto("label").values({ id: ulid(), project_id: p.id, name }).returningAll().executeTakeFirstOrThrow()) as any; L.labels.push(l); }
            if (l) labelIds.push(l.id);
          }
          const pts = get(r, idx.points), mins = get(r, idx.minutes), sd = get(r, idx.start), dd = get(r, idx.due);
          await createTicketRow(ctx, p, {
            title, description: get(r, idx.description), statusId: byName(L.statuses, "name", get(r, idx.status))?.id, typeId: byName(L.types, "name", get(r, idx.type))?.id,
            priority: (PRIORITIES as readonly string[]).includes(pri) ? pri : null, epicId: epic?.id ?? null, milestoneId: byName(L.milestones, "name", get(r, idx.milestone))?.id ?? null,
            labelIds, estimatePoints: pts && !Number.isNaN(Number(pts)) ? Number(pts) : null, estimateMinutes: mins && !Number.isNaN(Number(mins)) ? Math.round(Number(mins)) : null,
            startDate: isDate(sd) ? sd : null, dueDate: isDate(dd) ? dd : null,
          });
          imported++;
        } catch (e) {
          failed.push({ row: n + 1, error: (e as Error).message });
        }
      }
      return { imported, failed };
    },
  }),

  route({
    name: "importFromLinear", method: "POST", path: "/projects/:projectId/import/linear",
    description:
      "One-shot import of a Linear team: workflow states -> statuses (by name, created if missing), labels, issues (priority/estimate/dates/parent), Linear cycles -> milestones, " +
      "Linear projects -> epics. The API key is used for this request only and never stored. Re-running skips nothing, so import into a fresh project.",
    request: z.object({ projectId: z.string(), apiKey: z.string().min(10), teamKey: z.string().min(1) }),
    response: z.object({ tickets: z.number(), epics: z.number(), milestones: z.number(), labels: z.number() }),
    handler: async (ctx, { projectId, apiKey, teamKey }) => {
      const p = await resolveProject(ctx, projectId);
      const gql = async (query: string, variables: Record<string, unknown>) => {
        const res = await fetch("https://api.linear.app/graphql", { method: "POST", headers: { "content-type": "application/json", authorization: apiKey }, body: JSON.stringify({ query, variables }) });
        const json = (await res.json()) as any;
        if (!res.ok || json.errors) throw badRequest(`Linear API error: ${json.errors?.[0]?.message ?? res.statusText}`);
        return json.data;
      };
      const issues: any[] = [];
      let after: string | null = null;
      for (let page = 0; page < 100; page++) {
        const d: any = await gql(
          `query($team:String!,$after:String){ issues(first:100, after:$after, filter:{team:{key:{eq:$team}}}){ pageInfo{hasNextPage endCursor} nodes{ id identifier title description priority estimate startedAt dueDate createdAt state{name type color} labels{nodes{name color}} parent{id} cycle{id name startsAt endsAt completedAt description} project{id name description state targetDate startDate} } } }`,
          { team: teamKey, after },
        );
        issues.push(...d.issues.nodes);
        if (!d.issues.pageInfo.hasNextPage) break;
        after = d.issues.pageInfo.endCursor;
      }
      if (!issues.length) throw badRequest(`no issues found for Linear team ${teamKey}`);
      const L = await lookups(ctx, p.id);
      const cat: Record<string, string> = { backlog: "backlog", unstarted: "todo", started: "in_progress", completed: "done", canceled: "canceled" };
      const stats = { tickets: 0, epics: 0, milestones: 0, labels: 0 };
      const idMap = new Map<string, string>();
      const epicState: Record<string, string> = { backlog: "proposed", planned: "planned", started: "active", paused: "planned", completed: "completed", canceled: "canceled" };
      for (const i of issues) {
        // Reuse / create the matching status, epic, milestone and labels.
        let status = byName(L.statuses, "name", i.state.name);
        if (!status) {
          status = (await ctx.db.insertInto("status").values({ id: ulid(), project_id: p.id, name: i.state.name, color: i.state.color ?? "#9ca3af", category: cat[i.state.type] ?? "todo", position: (L.statuses.length + 1) * 1000 }).returningAll().executeTakeFirstOrThrow()) as any;
          L.statuses.push(status);
        }
        let epic = i.project ? byName(L.epics, "title", i.project.name) : undefined;
        if (i.project && !epic) {
          epic = (await ctx.db.insertInto("epic").values({ id: ulid(), project_id: p.id, title: i.project.name, description: i.project.description ?? "", status: epicState[i.project.state] ?? "planned", start_date: i.project.startDate ?? null, target_date: i.project.targetDate ?? null, position: (L.epics.length + 1) * 1000 }).returningAll().executeTakeFirstOrThrow()) as any;
          L.epics.push(epic); stats.epics++;
        }
        let ms = i.cycle ? byName(L.milestones, "name", i.cycle.name ?? `Cycle ${i.cycle.id.slice(0, 4)}`) : undefined;
        if (i.cycle && !ms && i.cycle.startsAt && i.cycle.endsAt) {
          ms = (await ctx.db.insertInto("milestone").values({ id: ulid(), project_id: p.id, name: i.cycle.name ?? `Cycle ${i.cycle.id.slice(0, 4)}`, goal: i.cycle.description ?? "", start_date: i.cycle.startsAt.slice(0, 10), end_date: i.cycle.endsAt.slice(0, 10), completed_at: i.cycle.completedAt ?? null }).returningAll().executeTakeFirstOrThrow()) as any;
          L.milestones.push(ms); stats.milestones++;
        }
        const labelIds: string[] = [];
        for (const lb of i.labels.nodes) {
          let l = byName(L.labels, "name", lb.name);
          if (!l) { l = (await ctx.db.insertInto("label").values({ id: ulid(), project_id: p.id, name: lb.name, color: lb.color ?? "#6b7280" }).returningAll().executeTakeFirstOrThrow()) as any; L.labels.push(l); stats.labels++; }
          labelIds.push(l.id);
        }
        // Linear priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low.
        const row = await createTicketRow(ctx, p, {
          title: i.title, description: i.description ?? "", statusId: status.id, epicId: epic?.id ?? null, milestoneId: ms?.id ?? null, labelIds,
          priority: ([null, "urgent", "high", "medium", "low"] as const)[i.priority] ?? null, estimatePoints: i.estimate ?? null, startDate: i.startedAt?.slice(0, 10) ?? null, dueDate: i.dueDate ?? null,
        });
        idMap.set(i.id, row.id as string);
        stats.tickets++;
      }
      // Second pass: parent links (parents may be imported after their children).
      for (const i of issues) {
        if (!i.parent || !idMap.has(i.parent.id)) continue;
        const parentId = idMap.get(i.parent.id)!;
        const parent = await ctx.db.selectFrom("ticket").select("parent_id").where("id", "=", parentId).executeTakeFirst();
        if (!parent?.parent_id) await ctx.db.updateTable("ticket").set({ parent_id: parentId }).where("id", "=", idMap.get(i.id)!).execute();
      }
      return stats;
    },
  }),
];
