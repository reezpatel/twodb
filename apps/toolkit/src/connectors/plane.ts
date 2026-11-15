/**
 * Plane connector (self-hosted or cloud). One instance = one workspace on
 * one Plane deployment. Talks to the external REST API v1
 * (`{baseUrl}/api/v1/workspaces/{slug}/...`, X-API-Key header), verified
 * against a live self-hosted instance.
 *
 * Commands are the execution tools other apps invoke; the poller diffs issue
 * fingerprints every 30s and broadcasts `plane.issue.changed` (+created/
 * deleted detail) which listeners consume live or via durable queues.
 */
import { createHash } from "node:crypto";
import type { ConnectorTemplate, ConnectorRuntime } from "./types.js";

const POLL_INTERVAL_MS = 90_000;

/** Errors the poller should swallow per-project (token lacks that project) instead of failing the run. */
const QUIET_STATUSES = new Set([403, 404]);

interface PlaneIssue {
  id: string;
  name: string;
  sequence_id: number;
  state: string | null;
  priority: string | null;
  assignees: string[] | null;
  labels: string[] | null;
  start_date: string | null;
  target_date: string | null;
  updated_at: string;
  project: string;
  [k: string]: unknown;
}

interface PlaneProject { id: string; name: string; identifier: string; description_text: string | null; state: string | null; [k: string]: unknown }
interface PlaneState { id: string; name: string; group: string; color: string | null; [k: string]: unknown }
interface PlaneCycle { id: string; name: string; start_date: string | null; end_date: string | null; [k: string]: unknown }

class PlaneError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function client(baseUrl: string, apiKey: string) {
  const root = baseUrl.replace(/\/+$/, "");
  const url = (path: string, params?: Record<string, string>) => {
    const u = new URL(`${root}/api/v1${path}`);
    for (const [k, v] of Object.entries(params ?? {})) u.searchParams.set(k, v);
    return u.toString();
  };
  return {
    async get<T>(path: string, params?: Record<string, string>): Promise<T> {
      const res = await fetch(url(path, params), { headers: { "X-API-Key": apiKey, accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new PlaneError(await errText(res), res.status);
      return (await res.json()) as T;
    },
    async post<T>(path: string, body: unknown): Promise<T> {
      const res = await fetch(url(path), { method: "POST", headers: { "X-API-Key": apiKey, "content-type": "application/json" }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new PlaneError(await errText(res), res.status);
      return (await res.json()) as T;
    },
    async patch<T>(path: string, body: unknown): Promise<T> {
      const res = await fetch(url(path), { method: "PATCH", headers: { "X-API-Key": apiKey, "content-type": "application/json" }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new PlaneError(await errText(res), res.status);
      return (await res.json()) as T;
    },
  };
}

async function errText(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text);
    const detail = j.detail ?? j.error ?? j.message;
    if (typeof detail === "string") return detail;
  } catch { /* raw below */ }
  return text.slice(0, 300) || `HTTP ${res.status}`;
}

/** Cursor-paginated v1 list envelope. */
interface PlaneList<T> { results: T[]; next_cursor: string | null; next_page_results: boolean }

/** 403/404 on a sub-resource = this token can't see that project — skip it, not an error. */
class PlaneQuietError extends PlaneError {}

async function listAll<T>(c: ReturnType<typeof client>, path: string, params?: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const p = { ...params, ...(cursor ? { cursor } : {}) };
    const env = await c.get<PlaneList<T>>(path, p);
    out.push(...(env.results ?? []));
    if (!env.next_page_results || !env.next_cursor) break;
    cursor = env.next_cursor;
  }
  return out;
}

/** Like listAll but returns [] (instead of throwing) on 403/404 — for per-project fan-out. */
async function listAllQuiet<T>(c: ReturnType<typeof client>, path: string, params?: Record<string, string>): Promise<T[]> {
  try {
    return await listAll<T>(c, path, params);
  } catch (err) {
    if (err instanceof PlaneError && QUIET_STATUSES.has(err.status)) return [];
    throw err;
  }
}

// --- shared shape helpers ---------------------------------------------------

function issueOut(issue: PlaneIssue, project: { id: string; name: string; identifier: string }): Record<string, unknown> {
  return {
    id: issue.id,
    name: issue.name,
    sequenceId: issue.sequence_id,
    url: `${project.identifier}-${issue.sequence_id}`,
    projectId: issue.project,
    projectName: project.name,
    stateId: issue.state ?? null,
    priority: issue.priority ?? null,
    assigneeIds: issue.assignees ?? [],
    labelIds: issue.labels ?? [],
    startDate: issue.start_date ?? null,
    targetDate: issue.target_date ?? null,
    isDraft: Boolean(issue.is_draft),
    updatedAt: issue.updated_at,
    createdAt: issue.created_at,
  };
}

function projectOut(p: PlaneProject): Record<string, unknown> {
  return { id: p.id, name: p.name, identifier: p.identifier, description: p.description_text ?? null, updatedAt: p.updated_at, createdAt: p.created_at };
}

/** Find which project owns an issue (ws-level lookups 403 on some instances —
 *  scan per-project routes instead; ws route first as the fast path). */
async function locateIssue(c: ReturnType<typeof client>, slug: string, issueId: string): Promise<{ issue: PlaneIssue; projectId: string }> {
  try {
    const issue = await c.get<PlaneIssue>(`/workspaces/${slug}/work-items/${issueId}/`);
    if (issue.project) return { issue, projectId: String(issue.project) };
  } catch { /* fall through to scan */ }
  const projects = await listAll<PlaneProject>(c, `/workspaces/${slug}/projects/`);
  for (const p of projects) {
    try {
      const issue = await c.get<PlaneIssue>(`/workspaces/${slug}/projects/${p.id}/issues/${issueId}/`);
      return { issue, projectId: p.id };
    } catch { /* next */ }
  }
  throw new PlaneError(`issue ${issueId} not found`, 404);
}

// --- fingerprinting for the poller -------------------------------------------

interface FingerprintMap { [issueId: string]: string }

function fingerprint(i: PlaneIssue): string {
  return createHash("sha256").update(JSON.stringify([i.name, i.state, i.priority, i.assignees ?? [], i.labels ?? [], i.start_date, i.target_date, i.updated_at])).digest("hex").slice(0, 16);
}

// --- template ----------------------------------------------------------------

export const planeTemplate: ConnectorTemplate = {
  id: "plane",
  name: "Planes",
  description: "Work items, projects, cycles and states from a Plane workspace (self-hosted or cloud). Commands execute immediately; a background poller broadcasts issue changes.",
  icon: "plane",
  fields: [
    { key: "baseUrl", label: "Base URL", required: true, placeholder: "https://planes.example.com", help: "Your Plane instance root (no /api suffix)." },
    { key: "apiKey", label: "API key", secret: true, required: true, placeholder: "plane_api_…", help: "Profile Settings → Personal access tokens. Needs workspace Member role or higher." },
    { key: "workspaceSlug", label: "Workspace slug", required: true, placeholder: "my-team", help: "The slug in your Plane URLs: planes.example.com/<slug>/projects/…" },
  ],
  commands: [
    {
      name: "list_projects",
      description: "List the workspace's projects (id, name, identifier, description).",
      params: {},
    },
    {
      name: "list_states",
      description: "List workflow states of a project (id, name, group).",
      params: { projectId: { type: "string", description: "Project id (from list_projects)", required: true } },
    },
    {
      name: "list_cycles",
      description: "List cycles of a project with their date windows.",
      params: { projectId: { type: "string", description: "Project id (from list_projects)", required: true } },
    },
    {
      name: "list_issues",
      description: "List work items of a project, newest first (optionally filtered).",
      params: {
        projectId: { type: "string", description: "Project id (from list_projects)", required: true },
        stateId: { type: "string", description: "Filter by state id" },
        assigneeId: { type: "string", description: "Filter by assignee id (member id)" },
        limit: { type: "number", description: "Max items (default 50)" },
      },
    },
    {
      name: "search_issues",
      description: "Search work items across the whole workspace by a text query (name/description).",
      params: { query: { type: "string", description: "Search text", required: true }, limit: { type: "number", description: "Max items (default 20)" } },
    },
    {
      name: "get_issue",
      description: "Fetch one work item with description html.",
      params: { issueId: { type: "string", description: "Issue id", required: true } },
    },
    {
      name: "create_issue",
      description: "Create a work item in a project.",
      params: {
        projectId: { type: "string", description: "Project id", required: true },
        name: { type: "string", description: "Title", required: true },
        description: { type: "string", description: "Description (HTML allowed)" },
        priority: { type: "enum", description: "none | low | medium | high | urgent", options: ["none", "low", "medium", "high", "urgent"] },
        stateId: { type: "string", description: "Target state id" },
        assigneeIds: { type: "string", description: "Comma-separated member ids" },
        targetDate: { type: "date", description: "Due date (YYYY-MM-DD)" },
      },
    },
    {
      name: "update_issue",
      description: "Update fields of a work item (only provided fields change).",
      params: {
        issueId: { type: "string", description: "Issue id", required: true },
        name: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        priority: { type: "enum", description: "none | low | medium | high | urgent", options: ["none", "low", "medium", "high", "urgent"] },
        stateId: { type: "string", description: "New state id" },
        assigneeIds: { type: "string", description: "Comma-separated member ids (replaces the list)" },
        targetDate: { type: "date", description: "New due date (YYYY-MM-DD)" },
      },
    },
    {
      name: "add_issue_comment",
      description: "Comment on a work item (comments are broadcast-relevant activity).",
      params: { issueId: { type: "string", description: "Issue id", required: true }, comment: { type: "string", description: "Comment text (HTML allowed)", required: true } },
    },
  ],
  broadcasts: [
    { event: "plane.issue.created", description: "A new work item appeared in the workspace." },
    { event: "plane.issue.changed", description: "A work item's title/state/priority/assignees/labels/dates changed." },
    { event: "plane.issue.deleted", description: "A work item disappeared from the workspace." },
  ],
  pollIntervalMs: POLL_INTERVAL_MS,

  async healthCheck(config) {
    const c = client(config.baseUrl, config.apiKey);
    const projects = await listAll<PlaneProject>(c, `/workspaces/${config.workspaceSlug}/projects/`, { per_page: "10" });
    if (!Array.isArray(projects)) throw new Error("unexpected API response");
  },

  async execute(command, params, rt) {
    const c = client(rt.config.baseUrl, rt.config.apiKey);
    const slug = rt.config.workspaceSlug;

    // projects are needed to name issues; fetch lazily per command
    const projectsById = async () => {
      const projects = await listAll<PlaneProject>(c, `/workspaces/${slug}/projects/`);
      return new Map(projects.map((p) => [p.id, p]));
    };

    switch (command) {
      case "list_projects": {
        const projects = await projectsById();
        return { projects: [...projects.values()].map(projectOut) };
      }
      case "list_states": {
        const states = await listAll<PlaneState>(c, `/workspaces/${slug}/projects/${req(params.projectId)}/states/`);
        return { states: states.map((s) => ({ id: s.id, name: s.name, group: s.group, color: s.color })) };
      }
      case "list_cycles": {
        const cycles = await listAll<PlaneCycle>(c, `/workspaces/${slug}/projects/${req(params.projectId)}/cycles/`);
        return { cycles: cycles.map((cy) => ({ id: cy.id, name: cy.name, startDate: cy.start_date, endDate: cy.end_date })) };
      }
      case "list_issues": {
        const projectId = req(params.projectId);
        const filter: Record<string, string> = {};
        if (params.stateId) filter.state = String(params.stateId);
        if (params.assigneeId) filter.assignee = String(params.assigneeId);
        const issues = await listAll<PlaneIssue>(c, `/workspaces/${slug}/projects/${projectId}/issues/`, { ...filter, order_by: "-created_at" });
        const limit = numberOr(params.limit, 50);
        const projects = await projectsById();
        const project = projects.get(projectId) ?? { id: projectId, name: "unknown", identifier: "?" };
        return { issues: issues.slice(0, limit).map((i) => issueOut(i, project)) };
      }
      case "search_issues": {
        const q = req(params.query).toLowerCase();
        const limit = numberOr(params.limit, 20);
        const projects = await projectsById();
        const matched: Array<Record<string, unknown>> = [];
        for (const project of projects.values()) {
          if (matched.length >= limit) break;
          const issues = await listAll<PlaneIssue>(c, `/workspaces/${slug}/projects/${project.id}/issues/`, { search: q, per_page: "50" });
          for (const i of issues) {
            if (matched.length >= limit) break;
            matched.push(issueOut(i, project));
          }
        }
        return { issues: matched, query: q };
      }
      case "get_issue": {
        const issueId = req(params.issueId);
        const located = await locateIssue(c, slug, issueId);
        const projects = await projectsById();
        const project = projects.get(located.projectId) ?? { id: located.projectId, name: "unknown", identifier: "?" };
        return { issue: { ...issueOut(located.issue, project), descriptionHtml: located.issue.description_html ?? null } };
      }
      case "create_issue": {
        const body: Record<string, unknown> = { name: req(params.name) };
        if (params.description) body.description_html = String(params.description);
        if (params.priority) body.priority = String(params.priority);
        if (params.stateId) body.state = String(params.stateId);
        if (params.assigneeIds) body.assignees = csv(params.assigneeIds);
        if (params.targetDate) body.target_date = String(params.targetDate);
        const created = await c.post<PlaneIssue>(`/workspaces/${slug}/projects/${req(params.projectId)}/issues/`, body);
        const projects = await projectsById();
        const project = projects.get(String(created.project ?? params.projectId)) ?? { id: String(params.projectId), name: "unknown", identifier: "?" };
        await rt.emit("plane.issue.created", { issue: issueOut(created, project) });
        return { issue: issueOut(created, project) };
      }
      case "update_issue": {
        const issueId = req(params.issueId);
        const body: Record<string, unknown> = {};
        if (params.name !== undefined) body.name = String(params.name);
        if (params.description !== undefined) body.description_html = String(params.description);
        if (params.priority !== undefined) body.priority = String(params.priority);
        if (params.stateId !== undefined) body.state = String(params.stateId);
        if (params.assigneeIds !== undefined) body.assignees = csv(params.assigneeIds);
        if (params.targetDate !== undefined) body.target_date = params.targetDate === null ? null : String(params.targetDate);
        // ws-level work-item writes 403 on some instances — resolve the owning
        // project via per-project GET, then PATCH through the project route.
        const located = await locateIssue(c, slug, issueId);
        const updated = await c.patch<PlaneIssue>(`/workspaces/${slug}/projects/${located.projectId}/issues/${issueId}/`, body);
        const projects = await projectsById();
        const project = projects.get(updated.project ?? located.projectId) ?? { id: located.projectId, name: "unknown", identifier: "?" };
        await rt.emit("plane.issue.changed", { issue: issueOut(updated, project), reason: "command" });
        return { issue: issueOut(updated, project) };
      }
      case "add_issue_comment": {
        const issueId = req(params.issueId);
        const located = await locateIssue(c, slug, issueId);
        const comment = await c.post<{ id: string }>(`/workspaces/${slug}/projects/${located.projectId}/issues/${issueId}/comments/`, { comment_html: String(params.comment) });
        return { comment: { id: comment.id } };
      }
      default:
        throw new Error(`unknown command "${command}"`);
    }
  },

  async poll(rt) {
    const c = client(rt.config.baseUrl, rt.config.apiKey);
    const slug = rt.config.workspaceSlug;
    const projects = await listAll<PlaneProject>(c, `/workspaces/${slug}/projects/`);
    const prev = (await rt.getState<FingerprintMap>()) ?? {};

    const current: FingerprintMap = {};
    let created = 0, changed = 0, deleted = 0, skipped = 0;
    const seen = new Set<string>();

    for (const project of projects) {
      // a token without access to one project returns 403 there — poll the rest
      const issues = await listAllQuiet<PlaneIssue>(c, `/workspaces/${slug}/projects/${project.id}/issues/`, { per_page: "100", order_by: "-updated_at" });
      if (issues.length === 0) { skipped++; continue; }
      for (const issue of issues) {
        seen.add(issue.id);
        const fp = fingerprint(issue);
        current[issue.id] = fp;
        if (!(issue.id in prev)) {
          if (Object.keys(prev).length > 0) { // first-ever run just baselines
            created++;
            await rt.emit("plane.issue.created", { issue: issueOut(issue, project) });
          }
        } else if (prev[issue.id] !== fp) {
          changed++;
          await rt.emit("plane.issue.changed", { issue: issueOut(issue, project), reason: "poll" });
        }
      }
    }

    for (const id of Object.keys(prev)) {
      if (!seen.has(id)) {
        deleted++;
        await rt.emit("plane.issue.deleted", { issueId: id });
      }
    }

    await rt.setState(current);
    if (created || changed || deleted) rt.log(`plane: +${created} ~${changed} -${deleted} (skipped ${skipped} inaccessible projects)`);
  },
};

function req(v: unknown): string {
  if (v === undefined || v === null || String(v).trim() === "") throw new Error(`missing required parameter`);
  return String(v).trim();
}
function numberOr(v: unknown, dflt: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}
function csv(v: unknown): string[] {
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}
