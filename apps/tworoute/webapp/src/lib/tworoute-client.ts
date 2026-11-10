// Thin client over TwoRoute's API — always through the gateway (dev proxy
// /tworoute-api → /apps/tworoute), so identity is the shared control-plane
// session resolved by TwoDB and forwarded as x-twodb-* headers.
// Spaces come from the control plane itself (/registry/spaces).

export interface Connection {
  id: string;
  spaceId: string;
  name: string;
  provider: string;
  baseUrl: string;
  defaultModel: string | null;
  createdAt: string;
}

export interface ProviderField {
  key: string;
  label: string;
  secret?: boolean;
  optional?: boolean;
  placeholder?: string;
}

export interface ProviderSpec {
  id: string;
  label: string;
  fields: ProviderField[];
  api: "anthropic" | "openai" | "responses";
  auth: "x-api-key" | "bearer" | "claude-oauth" | "codex-oauth";
  authKey?: string;
  defaultBaseUrl?: string;
  models: string[];
}

export interface CachedModel {
  modelId: string;
  displayName: string | null;
  contextWindow: number | null;
  thinking: boolean;
  input: string[];
  thinkingLevel: string[];
  temperature: boolean;
  limitContext: number | null;
  limitInput: number | null;
  limitOutput: number | null;
  costInput: number | null;
  costOutput: number | null;
  costCacheRead: number | null;
  output: string[];
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

export interface UsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  lastUsedAt: string | null;
}

const BASE = "/tworoute-api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: `${res.status}` }))).error ?? `${res.status}`);
  return res.json() as Promise<T>;
}

export const tworouteClient = {
  listProviders(): Promise<ProviderSpec[]> {
    return fetch(`${BASE}/providers`, { credentials: "include" }).then((r) => json(r));
  },

  listConnections(): Promise<Connection[]> {
    return fetch(`${BASE}/connections`, { credentials: "include" }).then((r) => json(r));
  },

  createConnection(input: {
    spaceId: string;
    name: string;
    provider: string;
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string;
    config?: Record<string, string>;
  }): Promise<{ id: string }> {
    return fetch(`${BASE}/connections`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    }).then((r) => json(r));
  },

  patchConnection(
    id: string,
    patch: {
      name?: string;
      spaceId?: string;
      baseUrl?: string;
      defaultModel?: string | null;
      apiKey?: string;
      config?: Record<string, string>;
    },
  ): Promise<{ ok: true }> {
    return fetch(`${BASE}/connections/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    }).then((r) => json(r));
  },

  deleteConnection(id: string): Promise<{ ok: true }> {
    return fetch(`${BASE}/connections/${id}`, { method: "DELETE", credentials: "include" }).then((r) => json(r));
  },

  testConnection(id: string): Promise<{ ok: true; via: string; modelCount?: number }> {
    return fetch(`${BASE}/connections/${id}/test`, { method: "POST", credentials: "include" }).then((r) => json(r));
  },

  listModels(id: string): Promise<{ models: CachedModel[] }> {
    return fetch(`${BASE}/connections/${id}/models`, { credentials: "include" }).then((r) => json(r));
  },

  refreshModels(id: string): Promise<{ count: number; warning?: string }> {
    return fetch(`${BASE}/connections/${id}/refresh-models`, { method: "POST", credentials: "include" }).then((r) => json(r));
  },

  listQuotas(): Promise<{ quotas: QuotaSnapshot[] }> {
    return fetch(`${BASE}/quotas`, { credentials: "include" }).then((r) => json(r));
  },

  refreshQuotas(id: string): Promise<{ quotas: QuotaSnapshot[] }> {
    return fetch(`${BASE}/connections/${id}/refresh-quotas`, { method: "POST", credentials: "include" }).then((r) => json(r));
  },

  /** Refreshes every supported connection's quota snapshots in one sweep. */
  refreshAllQuotas(): Promise<{
    results: Array<{
      connectionId: string;
      connectionName: string;
      status: "ok" | "error" | "skipped";
      detail?: string;
      quotas?: QuotaSnapshot[];
    }>;
    quotas: QuotaSnapshot[];
  }> {
    return fetch(`${BASE}/connections/refresh-quotas`, { method: "POST", credentials: "include" }).then((r) => json(r));
  },

  usageTotals(id: string): Promise<UsageTotals> {
    return fetch(`${BASE}/connections/${id}/usage`, { credentials: "include" }).then((r) => json(r));
  },

  /** 24h usage summary per (connection, model) — feeds every widget. */
  analyticsSummary(connectionId?: string): Promise<{
    since: string;
    days: number;
    rows: Array<{
      connectionId: string;
      model: string;
      calls: number;
      completed: number;
      failed: number;
      inputTokens: number;
      outputTokens: number;
      avgLatencyMs: number | null;
      p95LatencyMs: number | null;
    }>;
  }> {
    const qs = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
    return fetch(`${BASE}/analytics/summary${qs}`, { credentials: "include" }).then((r) => json(r));
  },

  /** Tool invocations grouped per tool (24h by default). */
  analyticsTools(connectionId?: string): Promise<{
    since: string;
    days: number;
    tools: Array<{ name: string; calls: number; completed: number; failed: number }>;
  }> {
    const qs = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
    return fetch(`${BASE}/analytics/tools${qs}`, { credentials: "include" }).then((r) => json(r));
  },

  /** Daily call buckets per connection (up to a year), completed/failed split. */
  analyticsCalls(connectionId?: string, days = 365): Promise<{
    since: string;
    days: number;
    buckets: Array<{ connectionId: string; day: string; calls: number; completed: number; failed: number }>;
  }> {
    const params = new URLSearchParams({ days: String(days) });
    if (connectionId) params.set("connectionId", connectionId);
    return fetch(`${BASE}/analytics/calls?${params}`, { credentials: "include" }).then((r) => json(r));
  },

  oauthStart(provider: "claude-code" | "codex"): Promise<{ url: string; state: string }> {
    return fetch(`${BASE}/oauth/${provider}/start`, { method: "POST", credentials: "include" }).then((r) => json(r));
  },

  oauthPoll(provider: "claude-code" | "codex", state: string): Promise<Record<string, unknown>> {
    return fetch(`${BASE}/oauth/${provider}/poll`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ state }),
    }).then((r) => json(r));
  },
};

export const controlPlaneClient = {
  listSpaces(): Promise<{ spaces: Array<{ id: string; name: string }> }> {
    return fetch("/registry/spaces", { credentials: "include" }).then((r) => json(r));
  },
};
