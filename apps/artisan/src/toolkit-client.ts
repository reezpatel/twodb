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

export interface ToolkitAgent {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

async function call<T>(serviceFetch: ServiceCaller["serviceFetch"], workspaceId: string, path: string, init?: RequestInit): Promise<T> {
  const res = await serviceFetch(TOOLKIT_APP, workspaceId, path, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body;
    try { detail = JSON.parse(body).error ?? body; } catch { /* raw */ }
    throw new Error(`toolkit answered ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  return (await res.json()) as T;
}

export function createToolkitClient(serviceFetch: ServiceCaller["serviceFetch"]) {
  return {
    /** Tools visible to THIS agent in THIS space (toolkit filters). */
    async listTools(workspaceId: string, agentId: string, spaceId: string | null): Promise<ToolkitTool[]> {
      const q = new URLSearchParams({ agentId });
      if (spaceId) q.set("spaceId", spaceId);
      // gateway forwards the session's space ids as x-twodb-space-ids; we add
      // our own agentId — toolkit combines both filters.
      return call<ToolkitTool[]>(serviceFetch, workspaceId, `/tools?${q.toString()}`);
    },

    /** Call a tool by its agent-facing NAME. Toolkit validates params + access. */
    async invokeTool(workspaceId: string, agentId: string, spaceId: string | null, toolName: string, params: Record<string, unknown>): Promise<unknown> {
      const q = new URLSearchParams({ agentId });
      if (spaceId) q.set("spaceId", spaceId);
      return call<{ output: unknown }>(serviceFetch, workspaceId, `/tools/${encodeURIComponent(toolName)}/invoke?${q.toString()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
