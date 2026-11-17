import type { ServiceCaller } from "./server.js";

/**
 * Toolkit client — Artisan calls toolkit app-to-app through the gateway
 * (serviceFetch, workspace-scoped). Toolkit owns everything downstream:
 * tool listing filtered by agent + space, name resolution, validation.
 */

const TOOLKIT_APP = "toolkit";

export interface ToolkitTool {
  id: string;
  instanceId: string;
  instanceName: string;
  templateId: string;
  /** Agent-facing name: `<instance>_<command>` (slugified instance name). */
  name: string;
  description: string;
  params: Record<string, { type: "string" | "number" | "boolean" | "enum" | "date"; description: string; required?: boolean; options?: string[] }>;
}

export interface TwodbParam { name: string; in: "path" | "query" | "body"; type: string; description: string; required: boolean; options?: string[] }
export interface TwodbTool { key: string; app: string; appName: string; name: string; description: string; method: string; path: string; params: TwodbParam[] }

export interface ToolkitAgent {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

type ServiceFetch = ServiceCaller["serviceFetch"];
/** Every artisan→toolkit call acts in the workspace (toolkit reads/writes per-agent state), so it always carries the act scope. */
const ACT_SCOPES = ["gateway.act"];

async function call<T>(serviceFetch: ServiceFetch, workspaceId: string, path: string, init?: RequestInit): Promise<T> {
  const res = await serviceFetch(TOOLKIT_APP, workspaceId, path, { ...init, scopes: ACT_SCOPES });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body;
    try { detail = JSON.parse(body).error ?? body; } catch { /* raw */ }
    throw new Error(`toolkit answered ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  return (await res.json()) as T;
}

/** The call's space, as the header toolkit scopes on (the gateway forwards it for granted app callers). */
const spaceHeaders = (spaceId: string | null): Record<string, string> => (spaceId ? { "x-twodb-space-ids": spaceId } : {});

export function createToolkitClient(serviceFetch: ServiceCaller["serviceFetch"]) {
  const scoped = (agentId: string, spaceId: string | null) => {
    const q = new URLSearchParams({ agentId });
    if (spaceId) q.set("spaceId", spaceId);
    return q.toString();
  };
  return {
    /** Tools visible to THIS agent in THIS space (toolkit filters). */
    async listTools(workspaceId: string, agentId: string, spaceId: string | null): Promise<ToolkitTool[]> {
      const q = new URLSearchParams({ agentId });
      if (spaceId) q.set("spaceId", spaceId);
      // gateway forwards the session's space ids as x-twodb-space-ids; we add
      // our own agentId — toolkit combines both filters.
      return call<ToolkitTool[]>(serviceFetch, workspaceId, `/tools?${q.toString()}`, { headers: spaceHeaders(spaceId) });
    },

    /** Call a tool by its agent-facing NAME. Toolkit validates params + access. */
    async invokeTool(workspaceId: string, agentId: string, spaceId: string | null, toolName: string, params: Record<string, unknown>): Promise<unknown> {
      const q = new URLSearchParams({ agentId });
      if (spaceId) q.set("spaceId", spaceId);
      return call<{ output: unknown }>(serviceFetch, workspaceId, `/tools/${encodeURIComponent(toolName)}/invoke?${q.toString()}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...spaceHeaders(spaceId) },
        body: JSON.stringify({ params }),
      }).then((r) => r.output);
    },

    // --- TwoDB tools: the app API surface behind four meta-tools; toolkit enforces per-agent / per-space access ---
    async twodbApps(workspaceId: string, agentId: string, spaceId: string | null): Promise<Array<{ slug: string; name: string; tools: number }>> {
      return call(serviceFetch, workspaceId, `/twodb/apps?${scoped(agentId, spaceId)}`, { headers: spaceHeaders(spaceId) });
    },
    async twodbAppTools(workspaceId: string, agentId: string, spaceId: string | null, app: string): Promise<Array<{ name: string; method: string; description: string }>> {
      return call(serviceFetch, workspaceId, `/twodb/apps/${encodeURIComponent(app)}/tools?${scoped(agentId, spaceId)}`, { headers: spaceHeaders(spaceId) });
    },
    async twodbAppTool(workspaceId: string, agentId: string, spaceId: string | null, app: string, tool: string): Promise<TwodbTool> {
      return call(serviceFetch, workspaceId, `/twodb/apps/${encodeURIComponent(app)}/tools/${encodeURIComponent(tool)}?${scoped(agentId, spaceId)}`, { headers: spaceHeaders(spaceId) });
    },
    async twodbInvoke(workspaceId: string, agentId: string, spaceId: string | null, app: string, tool: string, params: Record<string, unknown>): Promise<unknown> {
      return call<{ output: unknown }>(serviceFetch, workspaceId, `/twodb/apps/${encodeURIComponent(app)}/tools/${encodeURIComponent(tool)}/invoke?${scoped(agentId, spaceId)}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...spaceHeaders(spaceId) },
        body: JSON.stringify({ params }),
      }).then((r) => r.output);
    },

    /** Agent catalog (toolkit proxies artisan's own /agents back to us). */
    async listAgents(workspaceId: string): Promise<ToolkitAgent[]> {
      return call<{ agents: ToolkitAgent[] }>(serviceFetch, workspaceId, "/agents").then((r) => r.agents);
    },
  };
}

export type ToolkitClient = ReturnType<typeof createToolkitClient>;
