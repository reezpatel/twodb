/** Artisan API client — every call goes through the gateway with the
 *  per-login Bearer token (in memory only, see gateway-token.ts). The gateway
 *  validates that one token for artisan + dispatch + tworoute alike, so
 *  artisan can propagate it downstream. Vite proxies /apps/* → gateway in dev. */

import { gatewayAuthHeader, gatewayToken } from "./gateway-token.js";

const BASE = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.error ?? body.message ?? `${res.status}`);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const headers = await gatewayAuthHeader();
  return fetch(`${BASE}${path}`, { headers }).then((r) => json<T>(r));
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const hasBody = body !== undefined;
  const headers = { ...(await gatewayAuthHeader()), ...(hasBody ? { "content-type": "application/json" } : {}) };
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  }).then((r) => json<T>(r));
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const headers = { ...(await gatewayAuthHeader()), "content-type": "application/json" };
  return fetch(`${BASE}${path}`, { method: "PATCH", headers, body: JSON.stringify(body) }).then((r) => json<T>(r));
}

async function del<T>(path: string): Promise<T> {
  const headers = await gatewayAuthHeader();
  return fetch(`${BASE}${path}`, { method: "DELETE", headers }).then((r) => json<T>(r));
}

/** Same-origin fetch to the artisan API with the in-memory gateway token.
 *  Use for the few components that call endpoints directly (editor, files,
 *  changes) instead of going through artisanClient methods. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = await gatewayAuthHeader();
  const headers = { ...(init.headers as Record<string, string> | undefined), ...auth };
  return fetch(`/api${path}`, { ...init, headers });
}

/** WS URL to an artisan WS endpoint, authenticated via ?access_token= (the
 *  gateway promotes it to Authorization; artisan accepts it too). */
export async function apiWsUrl(path: string): Promise<string> {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const token = await gatewayToken();
  const sep = path.includes("?") ? "&" : "?";
  return `${proto}://${window.location.host}/api${path}${sep}access_token=${encodeURIComponent(token)}`;
}


export interface DirectoryInfo {
  id: string;
  spaceId: string;
  runner: string;
  path: string;
  title: string;
  defaultModel: string | null;
  projectSettings: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean };
}

export interface SessionInfo {
  id: string;
  type: string;
  title: string;
  runner: string;
  directory: string;
  model: string;
  interactive: boolean;
  spaceId: string;
  agentId: string | null;
  parentSessionId: string | null;
  thinkingLevel?: string | null;
  archivedAt?: string | null;
  /** Sidebar badge: "ip" in-progress, "re" review, "do" done, "at" attention, "ho" hold; null = none. */
  marker?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageInfo {
  id: string;
  role: string;
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface InspectSnapshot {
  id: string;
  round: number;
  createdAt: string;
  tools: Array<{ type: string; function: { name: string; description?: string; parameters?: unknown } }>;
  messages: Array<{
    role: string;
    content: string | null;
    toolCallId?: string;
    toolCalls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  }>;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  /** Prompt size of the latest request — what currently fills the context window. */
  contextTokens?: number;
  calls: number;
  costUsd: number | null;
}

export interface QueueItemInfo {
  id: string;
  content: string;
}

export interface AskInfo {
  askId: string;
  questions: Array<{ question: string; options?: string[]; allowMultiple?: boolean }>;
}

export interface SessionDetail extends SessionInfo {
  thinkingLevel?: string | null;
  plan: Array<{ description: string; status: string }> | null;
  running: boolean;
  /** Server-side steering queue — survives client disconnects. */
  queue: QueueItemInfo[];
  /** A live ask_user question, present even when it opened while this client was away. */
  ask: AskInfo | null;
  usage: UsageInfo | null;
  messages: MessageInfo[];
}

export interface AgentInfo {
  id: string;
  type: string;
  name: string;
  description: string;
  model: string | null;
  tools: string[];
  skillTags: string[];
  tags: string[];
  runner: string | null;
  directory: string | null;
  spaceId: string;
  spaceIds: string[];
  instruction?: string;
}

export type SkillMode = "global" | "agents" | "spaces" | "types";

export type ScopeMode = SkillMode | "directories";
export type McpTransport = "auto" | "http" | "sse";
export interface McpScope {
  mode: ScopeMode;
  all: boolean;
  ids: string[];
}
export interface McpServerInfo {
  id: string;
  name: string;
  url: string;
  transport: McpTransport;
  headers: Record<string, string>;
  enabled: boolean;
  scope: McpScope;
  createdAt: string;
  updatedAt: string;
}
export interface McpImportPreview {
  drafts: Array<{ name: string; url: string; transport: McpTransport; headers: Record<string, string> }>;
  skipped: Array<{ name: string; reason: string }>;
}

export interface SkillScope {
  mode: SkillMode;
  /** true = unrestricted on the chosen dimension (ids ignored). */
  all: boolean;
  ids: string[];
}

export type MemoryLevel = "organization" | "code_directory" | "self" | "session";
export interface MemoryInfo {
  id: string;
  level: MemoryLevel;
  title: string;
  content: string;
  directoryId: string | null;
  agentId: string | null;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  scope: SkillScope;
  content?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  connection: string;
  contextWindow: number | null;
  thinking?: boolean;
  thinkingLevel?: string[];
}

export interface ToolInfo {
  name: string;
  description: string;
}

export interface SpaceInfo {
  id: string;
  name: string;
}

export interface MicrovmInfo {
  id: string;
  identifier: string;
  runnerId: string;
  runnerName: string | null;
  status: string;
  bootCount: number;
  lastActiveAt: string;
}

export interface RunnerInfo {
  name: string;
  status: string;
  kind: string;
}

export const artisanClient = {
  // --- sessions ---
  listSessions(filter?: { type?: string; runner?: string; directory?: string; all?: string; archived?: string; agentId?: string }): Promise<SessionInfo[]> {
    const q = new URLSearchParams();
    if (filter?.type) q.set("type", filter.type);
    if (filter?.runner) q.set("runner", filter.runner);
    if (filter?.directory) q.set("directory", filter.directory);
    if (filter?.all) q.set("all", filter.all);
    if (filter?.archived) q.set("archived", filter.archived);
    if (filter?.agentId) q.set("agentId", filter.agentId);
    const qs = q.toString();
    return get(`/sessions${qs ? `?${qs}` : ""}`);
  },

  deleteSession(id: string): Promise<{ ok: boolean }> {
    return del(`/sessions/${id}`);
  },

  getInspectRound(sessionId: string, inspectId: string): Promise<InspectSnapshot> {
    return get(`/sessions/${sessionId}/inspect/${inspectId}`);
  },

  getSession(id: string): Promise<SessionDetail> {
    return get(`/sessions/${id}`);
  },

  createSession(input: {
    spaceId?: string; type?: string; title?: string; runner?: string; directory?: string;
    model?: string; interactive?: boolean; agentId?: string | null; message?: string;
  }): Promise<SessionInfo> {
    return post("/sessions", input);
  },

  updateSession(id: string, patchBody: { title?: string; model?: string; archived?: boolean; marker?: string | null }): Promise<SessionInfo> {
    return patch(`/sessions/${id}`, patchBody);
  },

  sendMessage(id: string, message: string): Promise<{ ok: boolean }> {
    return post(`/sessions/${id}/messages`, { message });
  },

  newThread(id: string): Promise<{ ok: boolean }> {
    return post(`/sessions/${id}/new`);
  },

  compact(id: string): Promise<{ ok: boolean; summary: string }> {
    return post(`/sessions/${id}/compact`);
  },

  /** Live provider quota windows (proxied from TwoRoute by the artisan server). */
  providerQuotas(model?: string): Promise<{ connections: QuotaConnection[]; quotas: QuotaSnapshot[] }> {
    return get(model ? `/quotas?model=${encodeURIComponent(model)}` : "/quotas");
  },

  abort(id: string): Promise<{ ok: boolean }> {
    return post(`/sessions/${id}/abort`);
  },

  removeQueuedMessage(id: string, itemId: string): Promise<{ ok: boolean }> {
    return del(`/sessions/${id}/queue/${itemId}`);
  },

  sendQueueNow(id: string): Promise<{ ok: boolean }> {
    return post(`/sessions/${id}/queue/send`, {});
  },

  listRegisteredDirectories(): Promise<DirectoryInfo[]> {
    return get("/directories/registered");
  },
  createDirectory(input: { spaceId?: string; runner: string; path: string; title?: string; defaultModel?: string | null; projectSettings?: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean } }): Promise<DirectoryInfo> {
    return post("/directories", input);
  },
  updateDirectory(id: string, body: Partial<{ title: string; defaultModel: string | null; spaceId: string; projectSettings: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean } }>): Promise<DirectoryInfo> {
    return patch(`/directories/${id}`, body);
  },
  deleteDirectory(id: string): Promise<{ ok: boolean }> {
    return del(`/directories/${id}`);
  },
  listDirectories(): Promise<Array<{ runner: string; directory: string; spaceId: string; sessions: number; id?: string; title?: string; defaultModel?: string | null }>> {
    return get("/directories");
  },

  // --- agents ---
  listAgents(spaceId?: string): Promise<AgentInfo[]> {
    const q = spaceId ? `?spaceId=${spaceId}` : "";
    return get(`/agents${q}`);
  },

  createAgent(input: {
    spaceId?: string; spaceIds?: string[]; type: string; name: string; description?: string; instruction?: string;
    model?: string | null; tools?: string[]; skillTags?: string[]; tags?: string[]; runner?: string | null; directory?: string | null;
  }): Promise<AgentInfo> {
    return post("/agents", input);
  },

  updateAgent(id: string, body: Partial<{ name: string; spaceIds: string[]; description: string; instruction: string; model: string | null; tools: string[]; skillTags: string[]; tags: string[]; runner: string | null; directory: string | null }>): Promise<AgentInfo> {
    return patch(`/agents/${id}`, body);
  },

  deleteAgent(id: string): Promise<{ ok: boolean }> {
    return del(`/agents/${id}`);
  },

  // --- skills ---
  listMemories(sessionId?: string): Promise<MemoryInfo[]> {
    return get(`/memories${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`);
  },
  createMemory(input: { level: MemoryLevel; title: string; content: string; sessionId?: string; directoryId?: string; agentId?: string }): Promise<MemoryInfo> {
    return post("/memories", input);
  },
  updateMemory(id: string, body: { title?: string; content?: string }): Promise<MemoryInfo> {
    return patch(`/memories/${id}`, body);
  },
  deleteMemory(id: string): Promise<{ ok: boolean }> {
    return del(`/memories/${id}`);
  },

  listMcpServers(): Promise<McpServerInfo[]> {
    return get("/mcp");
  },
  getMcpServer(id: string): Promise<McpServerInfo> {
    return get(`/mcp/${id}`);
  },
  createMcpServer(input: { name: string; url: string; transport?: McpTransport; headers?: Record<string, string>; enabled?: boolean; scope: McpScope }): Promise<McpServerInfo> {
    return post("/mcp", input);
  },
  updateMcpServer(id: string, body: Partial<{ name: string; url: string; transport: McpTransport; headers: Record<string, string>; enabled: boolean; scope: McpScope }>): Promise<McpServerInfo> {
    return patch(`/mcp/${id}`, body);
  },
  deleteMcpServer(id: string): Promise<{ ok: boolean }> {
    return del(`/mcp/${id}`);
  },
  previewMcpImport(json: string): Promise<McpImportPreview> {
    return post("/mcp/import/preview", { json });
  },
  importMcpServers(json: string, scope: McpScope): Promise<{ created: McpServerInfo[]; conflicts: string[]; skipped: McpImportPreview["skipped"] }> {
    return post("/mcp/import", { json, scope });
  },

  listSkills(): Promise<SkillInfo[]> {
    return get("/skills");
  },

  getChatAgent(): Promise<{ id: string; instruction: string; model: string | null }> {
    return get("/settings/chat-agent");
  },
  async setChatAgent(body: { instruction?: string; model?: string | null }): Promise<{ id: string; instruction: string; model: string | null }> {
    return json(await fetch(`${BASE}/settings/chat-agent`, { method: "PUT", headers: { "content-type": "application/json", ...(await gatewayAuthHeader()) }, body: JSON.stringify(body) }));
  },
  getGlobalInstruction(): Promise<{ content: string; updatedAt: string | null }> {
    return get("/settings/global-instruction");
  },
  async setGlobalInstruction(content: string): Promise<{ content: string; updatedAt: string | null }> {
    return json(await fetch(`${BASE}/settings/global-instruction`, { method: "PUT", headers: { "content-type": "application/json", ...(await gatewayAuthHeader()) }, body: JSON.stringify({ content }) }));
  },

  getSkill(id: string): Promise<SkillInfo> {
    return get(`/skills/${id}`);
  },

  createSkill(input: { name: string; description?: string; content?: string; scope: SkillScope }): Promise<SkillInfo> {
    return post("/skills", input);
  },

  updateSkill(id: string, body: Partial<{ name: string; description: string; content: string; scope: SkillScope }>): Promise<SkillInfo> {
    return patch(`/skills/${id}`, body);
  },

  deleteSkill(id: string): Promise<{ ok: boolean }> {
    return del(`/skills/${id}`);
  },

  // --- proxies ---
  listModels(): Promise<ModelInfo[]> {
    return get("/models");
  },

  listRunners(): Promise<RunnerInfo[]> {
    return get("/runners");
  },

  /** Workspace spaces (served by the control plane, same origin). */
  async listSpaces(): Promise<SpaceInfo[]> {
    const res = await fetch("/registry/spaces", { credentials: "include", headers: await gatewayAuthHeader() });
    if (!res.ok) throw new Error(`${res.status}: unable to load spaces`);
    const body = (await res.json()) as SpaceInfo[] | { spaces: SpaceInfo[] };
    return Array.isArray(body) ? body : body.spaces;
  },

  getAgent(id: string): Promise<AgentInfo> {
    return get(`/agents/${id}`);
  },

  listTools(): Promise<ToolInfo[]> {
    return get("/tools");
  },

  listMicrovms(): Promise<MicrovmInfo[]> {
    return get("/microvms");
  },

  createMicrovm(input: { name?: string }): Promise<MicrovmInfo> {
    return post("/microvms", input);
  },

  listRunnerDir(runner: string, path: string): Promise<{ path: string; entries: Array<{ name: string; dir: boolean }> }> {
    return get(`/runners/${encodeURIComponent(runner)}/fs?path=${encodeURIComponent(path)}`);
  },

  makeRunnerDir(runner: string, path: string): Promise<{ ok: boolean; path: string }> {
    return post(`/runners/${encodeURIComponent(runner)}/fs/mkdir`, { path });
  },
};

/** Workspace WS: one connection, join/leave session rooms. */
export type ServerFrame = { sessionId: string } & Record<string, unknown> & { type: string };

export class WorkspaceSocket {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  private listeners = new Set<(frame: ServerFrame) => void>();
  private retryMs = 1000;
  /** Sessions this client is joined to — re-joined after a reconnect so
   * frames (deltas, done, ask_user) keep flowing after a network blip. */
  private joined = new Set<string>();

  connect(): void {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    void apiWsUrl("/ws")
      .catch(() => `${proto}://${window.location.host}/api/ws`)
      .then((url) => this.open(url));
  }

  private open(url: string): void {
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      // Ignore a stale open (a newer connect superseded this socket).
      if (this.ws !== ws) return;
      this.retryMs = 1000;
      // Re-join every session room first: the server dropped this socket
      // from all rooms when the old connection closed, and joins are what
      // re-sync live state (running/queue/ask) via the state frame.
      for (const sessionId of this.joined) ws.send(JSON.stringify({ type: "join", sessionId }));
      for (const raw of this.queue.splice(0)) ws.send(raw);
    };
    ws.onmessage = (ev) => {
      try {
        const frame = JSON.parse(ev.data as string) as ServerFrame;
        for (const l of this.listeners) l(frame);
      } catch {
        // malformed
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return; // superseded by a newer connect
      this.ws = null;
      setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 15_000);
    };
  }

  send(frame: unknown): void {
    const f = frame as { type?: string; sessionId?: string };
    if (f?.type === "join" && typeof f.sessionId === "string") this.joined.add(f.sessionId);
    if (f?.type === "leave" && typeof f.sessionId === "string") this.joined.delete(f.sessionId);
    const raw = JSON.stringify(frame);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(raw);
    else this.queue.push(raw);
  }

  onFrame(l: (frame: ServerFrame) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export interface QuotaSnapshot {
  id: string;
  connectionId: string;
  quotaType: string;
  groupName: string;
  unit: string;
  quotaTotal: number | null;
  quotaUsed: number;
  capturedAt: string;
  resetAt: string | null;
}

export interface QuotaConnection {
  id: string;
  name: string;
  provider: string;
}
