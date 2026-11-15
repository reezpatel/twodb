// Thin client over Toolkit's API — always through the gateway (dev proxy
// /apps/toolkit), so identity is the shared control-plane session resolved
// by TwoDB and forwarded as x-twodb-* headers. Spaces come from the control
// plane itself (/registry/spaces).

const BASE = "/apps/toolkit";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = JSON.parse(detail).error ?? detail;
    } catch {
      /* keep raw text */
    }
    throw new Error(detail || `${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface Scope {
  all: boolean;
  ids: string[];
}

export interface Space {
  id: string;
  name: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

export type McpTransport = "auto" | "http" | "sse";

export interface McpServer {
  id: string;
  name: string;
  url: string;
  transport: McpTransport;
  headers: Record<string, string>;
  enabled: boolean;
  scope: Scope;
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorField {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  help?: string;
}

export interface CommandParam {
  type: "string" | "number" | "boolean" | "enum" | "date";
  description: string;
  required?: boolean;
  options?: string[];
}

export interface ConnectorCommand {
  name: string;
  description: string;
  params: Record<string, CommandParam>;
}

export interface BroadcastEventSpec {
  event: string;
  description: string;
}

export interface ConnectorTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: ConnectorField[];
  commands: ConnectorCommand[];
  broadcasts: BroadcastEventSpec[];
  pollIntervalMs?: number;
}

export interface ConnectorInstance {
  id: string;
  templateId: string;
  name: string;
  enabled: boolean;
  scope: Scope;
  agentIds: string[];
  healthStatus: "ok" | "error" | null;
  healthError: string | null;
  healthCheckedAt: string | null;
  config: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Tool {
  id: string;
  instanceId: string;
  instanceName: string;
  templateId: string;
  name: string;
  description: string;
  params: Record<string, CommandParam>;
}

export interface BroadcastEvent {
  id: string;
  instanceId: string;
  event: string;
  payload: unknown;
  createdAt: string;
}

export interface QueueInfo {
  id: string;
  instanceId: string;
  name: string;
  createdBy: string | null;
  createdAt: string;
  pending: number;
}

export interface QueueItem {
  id: string;
  queueId: string;
  event: string;
  payload: unknown;
  status: string;
  createdAt: string;
  deliveredAt: string | null;
}

const get = <T>(path: string): Promise<T> => fetch(`${BASE}${path}`, { credentials: "include" }).then((r) => json<T>(r));
const send = <T>(path: string, method: string, body?: unknown): Promise<T> =>
  fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => json<T>(r));

export const toolkitClient = {
  // --- spaces (control plane) + agents (artisan's own /agents, same gateway session) ---
  listSpaces: () => fetch("/registry/spaces", { credentials: "include" }).then((r) => json<{ spaces: Space[] }>(r)),
  listAgents: async (): Promise<AgentInfo[]> => {
    const res = await fetch("/apps/artisan/agents", { credentials: "include" });
    if (!res.ok) {
      // fall back to toolkit's proxy (e.g. direct mode or artisan behind a different path)
      try {
        return (await get<{ agents: AgentInfo[] }>("/agents")).agents;
      } catch {
        return [];
      }
    }
    return (await res.json()) as AgentInfo[];
  },

  // --- MCP ---
  listMcp: () => get<McpServer[]>("/mcp"),
  createMcp: (input: { name: string; url: string; transport: McpTransport; headers?: Record<string, string>; enabled?: boolean; scope?: Scope; agentIds?: string[] }) =>
    send<McpServer>("/mcp", "POST", input),
  updateMcp: (id: string, patch: Partial<{ name: string; url: string; transport: McpTransport; headers: Record<string, string>; enabled: boolean; scope: Scope; agentIds: string[] }>) =>
    send<McpServer>(`/mcp/${id}`, "PATCH", patch),
  deleteMcp: (id: string) => send<{ ok: true }>(`/mcp/${id}`, "DELETE"),
  importMcp: (jsonText: string, scope?: Scope, agentIds?: string[]) =>
    send<{ created: McpServer[]; skipped: Array<{ name: string; reason: string }> }>("/mcp/import", "POST", { json: jsonText, scope, agentIds }),

  // --- templates + instances ---
  listTemplates: () => get<ConnectorTemplate[]>("/connector-templates"),
  listInstances: () => get<ConnectorInstance[]>("/instances"),
  getInstance: (id: string) => get<ConnectorInstance & { template: ConnectorTemplate; tools: Tool[] }>(`/instances/${id}`),
  createInstance: (input: { templateId: string; name: string; config: Record<string, string>; enabled?: boolean; scope?: Scope; agentIds?: string[]; force?: boolean }) =>
    send<ConnectorInstance>("/instances", "POST", input),
  updateInstance: (id: string, patch: Partial<{ name: string; config: Record<string, string>; enabled: boolean; scope: Scope; agentIds: string[]; force?: boolean }>) =>
    send<ConnectorInstance>(`/instances/${id}`, "PATCH", patch),
  deleteInstance: (id: string) => send<{ ok: true }>(`/instances/${id}`, "DELETE"),
  checkHealth: (id: string) => send<ConnectorInstance>(`/instances/${id}/health`, "POST"),
  runPoll: (id: string) => send<{ ok: true }>(`/instances/${id}/poll`, "POST"),

  // --- tools ---
  listTools: (templateId?: string) => get<Tool[]>(`/tools${templateId ? `?templateId=${encodeURIComponent(templateId)}` : ""}`),
  invokeTool: (toolId: string, params: Record<string, unknown>) => send<{ output: unknown }>(`/tools/${encodeURIComponent(toolId)}/invoke`, "POST", { params }),

  // --- broadcasts + queues ---
  listEvents: (params?: { instanceId?: string; event?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.instanceId) q.set("instanceId", params.instanceId);
    if (params?.event) q.set("event", params.event);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return get<{ events: BroadcastEvent[] }>(`/events${qs ? `?${qs}` : ""}`);
  },
  listQueues: (instanceId?: string) => get<{ queues: QueueInfo[] }>(`/queues${instanceId ? `?instanceId=${instanceId}` : ""}`),
  createQueue: (instanceId: string, name: string) => send<QueueInfo>("/queues", "POST", { instanceId, name }),
  deleteQueue: (instanceId: string, name: string) => send<{ ok: true }>(`/queues/${instanceId}/${name}`, "DELETE"),
  nextQueueItem: (instanceId: string, name: string) => send<{ item: QueueItem | null }>(`/queues/${instanceId}/${name}/next`, "POST"),
  peekQueue: (instanceId: string, name: string) => get<{ items: QueueItem[] }>(`/queues/${instanceId}/${name}/peek`),
};
