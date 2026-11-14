/** Artisan API client — same-origin through the gateway (vite proxies
 *  /artisan-api → /apps/artisan in dev). */

const BASE = "/artisan-api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.error ?? body.message ?? `${res.status}`);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  return fetch(`${BASE}${path}`, { credentials: "include" }).then((r) => json<T>(r));
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const hasBody = body !== undefined;
  return fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    ...(hasBody ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
  }).then((r) => json<T>(r));
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json<T>(r));
}

async function del<T>(path: string): Promise<T> {
  return fetch(`${BASE}${path}`, { method: "DELETE", credentials: "include" }).then((r) => json<T>(r));
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

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  calls: number;
  costUsd: number | null;
}

export interface SessionDetail extends SessionInfo {
  thinkingLevel?: string | null;
  plan: Array<{ description: string; status: string }> | null;
  running: boolean;
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
  instruction?: string;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  directory: string | null;
  tags: string[];
  spaceId: string;
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

export interface RunnerInfo {
  name: string;
  status: string;
  kind: string;
}

export const artisanClient = {
  // --- sessions ---
  listSessions(filter?: { type?: string; runner?: string; directory?: string; all?: string }): Promise<SessionInfo[]> {
    const q = new URLSearchParams();
    if (filter?.type) q.set("type", filter.type);
    if (filter?.runner) q.set("runner", filter.runner);
    if (filter?.directory) q.set("directory", filter.directory);
    if (filter?.all) q.set("all", filter.all);
    const qs = q.toString();
    return get(`/sessions${qs ? `?${qs}` : ""}`);
  },

  getSession(id: string): Promise<SessionDetail> {
    return get(`/sessions/${id}`);
  },

  createSession(input: {
    spaceId?: string; type?: string; title?: string; runner: string; directory: string;
    model?: string; interactive?: boolean; agentId?: string | null; message?: string;
  }): Promise<SessionInfo> {
    return post("/sessions", input);
  },

  updateSession(id: string, patchBody: { title?: string; model?: string }): Promise<SessionInfo> {
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

  abort(id: string): Promise<{ ok: boolean }> {
    return post(`/sessions/${id}/abort`);
  },

  listDirectories(): Promise<Array<{ runner: string; directory: string; spaceId: string; sessions: number }>> {
    return get("/directories");
  },

  // --- agents ---
  listAgents(spaceId?: string): Promise<AgentInfo[]> {
    const q = spaceId ? `?spaceId=${spaceId}` : "";
    return get(`/agents${q}`);
  },

  createAgent(input: {
    spaceId?: string; type: string; name: string; description?: string; instruction: string;
    model?: string | null; tools?: string[]; skillTags?: string[]; tags?: string[]; runner?: string | null; directory?: string | null;
  }): Promise<AgentInfo> {
    return post("/agents", input);
  },

  updateAgent(id: string, body: Partial<{ name: string; description: string; instruction: string; model: string | null; tools: string[]; skillTags: string[]; tags: string[]; runner: string | null; directory: string | null }>): Promise<AgentInfo> {
    return patch(`/agents/${id}`, body);
  },

  deleteAgent(id: string): Promise<{ ok: boolean }> {
    return del(`/agents/${id}`);
  },

  // --- skills ---
  listSkills(spaceId?: string): Promise<SkillInfo[]> {
    const q = spaceId ? `?spaceId=${spaceId}` : "";
    return get(`/skills${q}`);
  },

  createSkill(input: { spaceId?: string; directory?: string | null; name: string; description: string; content: string; tags?: string[] }): Promise<SkillInfo> {
    return post("/skills", input);
  },

  updateSkill(id: string, body: Partial<{ name: string; description: string; content: string; directory: string | null; tags: string[] }>): Promise<SkillInfo> {
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
};

/** Workspace WS: one connection, join/leave session rooms. */
export type ServerFrame = { sessionId: string } & Record<string, unknown> & { type: string };

export class WorkspaceSocket {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  private listeners = new Set<(frame: ServerFrame) => void>();
  private retryMs = 1000;

  connect(): void {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    this.ws = new WebSocket(`${proto}://${window.location.host}/apps/artisan/ws`);
    this.ws.onopen = () => {
      this.retryMs = 1000;
      for (const raw of this.queue.splice(0)) this.ws!.send(raw);
    };
    this.ws.onmessage = (ev) => {
      try {
        const frame = JSON.parse(ev.data as string) as ServerFrame;
        for (const l of this.listeners) l(frame);
      } catch {
        // malformed
      }
    };
    this.ws.onclose = () => {
      this.ws = null;
      setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 15_000);
    };
  }

  send(frame: unknown): void {
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
