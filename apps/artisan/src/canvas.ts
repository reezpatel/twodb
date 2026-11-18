import type { AgentRow, CanvasRow, SessionRow } from "./db/schema.js";
import type { ArtisanRepo } from "./db/repository.js";
import type { ToolSpec } from "./ws/agent-loop.js";

export const PAINTRESS_APP = "paintress";
export type ServiceFetch = (audience: string, workspaceId: string, path: string, init?: RequestInit & { scopes?: string[]; act?: { type: string; id: string } }) => Promise<Response>;

export interface CanvasContent {
  id: string;
  title: string;
  type: string;
  resourceId: string;
  markdown: string;
  version: number;
  updatedAt: string;
}

/** Directory-agent canvases are session-local; configured-agent canvases live at agent level. */
export function canvasOwner(session: SessionRow, agent: AgentRow): { sessionId: string } | { agentId: string } {
  return !session.agent_id || agent.type === "directory" ? { sessionId: session.id } : { agentId: agent.id };
}

/** Paintress group mirrors the Artisan owner while the space comes from the session. */
export function canvasGroupName(session: SessionRow, agent: AgentRow): string {
  if (agent.type !== "directory") return agent.id.slice(0, 100);
  return `${session.runner}-${session.directory}`.slice(0, 100);
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Paintress answered ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchCanvasContent(serviceFetch: ServiceFetch, workspaceId: string, row: CanvasRow): Promise<CanvasContent> {
  const response = await serviceFetch(PAINTRESS_APP, workspaceId, `/boards/${encodeURIComponent(row.resource_id)}`);
  const body = await responseJson<{ doc: { markdown: string; version: number } | null }>(response);
  return {
    id: row.id, title: row.title, type: row.type, resourceId: row.resource_id,
    markdown: body.doc?.markdown ?? "", version: body.doc?.version ?? 0, updatedAt: row.updated_at,
  };
}

/** The service fetch rides the tool context — the SessionRunner's deps
 * carry it too (a run dispatched after the last viewer disconnected can
 * still create/update canvases). */
export function canvasTools(serviceFetch?: ServiceFetch): ToolSpec[] {
  return [{
    name: "update_canvas",
    description: "Creates or updates a document in the Canvas tab. Pass the FULL Markdown content each time; an existing document with the same title is replaced.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Document title (1-120 characters)." },
        content: { type: "string", description: "The complete Markdown document." },
      },
      required: ["title", "content"],
    },
    async execute(args, ctx) {
      const sf = serviceFetch ?? ctx.serviceFetch;
      if (!sf) throw new Error("canvas integration unavailable");
      const title = String(args.title ?? "").trim().slice(0, 120);
      if (!title) throw new Error("title is required");
      const content = String(args.content ?? "");
      const owner = canvasOwner(ctx.session, ctx.agent);
      const existing = await ctx.repo.findCanvas(ctx.session.workspace_id, owner, title);

      if (existing) {
        const response = await sf(PAINTRESS_APP, ctx.session.workspace_id, `/boards/${encodeURIComponent(existing.resource_id)}/doc`, {
          method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ markdown: content }),
        });
        await responseJson(response);
        await ctx.repo.touchCanvas(existing.id);
        ctx.emit({ type: "canvas", canvasId: existing.id });
        return `canvas updated: ${title}`;
      }

      const response = await sf(PAINTRESS_APP, ctx.session.workspace_id, "/boards", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: title, kind: "doc", markdown: content,
          groupName: canvasGroupName(ctx.session, ctx.agent), spaceId: ctx.session.space_id,
        }),
      });
      const board = await responseJson<{ id: string }>(response);
      const row = await ctx.repo.createCanvas({
        workspaceId: ctx.session.workspace_id,
        ...(owner), type: "doc", title, resourceId: board.id,
      });
      ctx.emit({ type: "canvas", canvasId: row.id });
      return `canvas created: ${title}`;
    },
  }];
}

export async function listCanvasContent(input: {
  repo: ArtisanRepo; serviceFetch: ServiceFetch; session: SessionRow; agent: AgentRow;
}): Promise<CanvasContent[]> {
  const rows = await input.repo.listCanvases(input.session.workspace_id, canvasOwner(input.session, input.agent));
  const fetched = await Promise.all(rows.map((row) => fetchCanvasContent(input.serviceFetch, input.session.workspace_id, row).catch(() => null)));
  return fetched.filter((row): row is CanvasContent => row !== null);
}
