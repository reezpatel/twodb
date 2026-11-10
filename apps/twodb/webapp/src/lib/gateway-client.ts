// Thin client over TwoDB's own control-plane API. The webapp is served
// behind the same origin (Vite proxies /registry, /orchestrator, /apps in
// dev), so session cookies carry auth — no tokens handled here.

export interface RegisteredAppSummary {
  slug: string;
  name: string;
  basePath: string;
  status: string;
  installStatus: string;
  version: string | null;
}

export interface EndpointSpec {
  name: string;
  method: string;
  path: string;
  auth: string;
  description?: string;
  streaming?: boolean;
  request?: unknown; // JSON Schema
  response?: unknown; // JSON Schema
}

export interface EndpointJson {
  name: string;
  slug: string;
  version: string;
  description?: string;
  basePath: string;
  endpoints: EndpointSpec[];
}

export interface MessagesJson {
  name: string;
  slug: string;
  jobs: Array<{ type: string; description: string; direction: string; payload: unknown }>;
  events: Array<{ event: string; description: string; direction: string; payload: unknown }>;
}

export interface AppStatus {
  slug: string;
  installStatus: string;
  registrationStatus: string;
  containerStatus: string;
  version: string | null;
  imageTag: string | null;
  lastSeenAt: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const gatewayClient = {
  listApps(): Promise<RegisteredAppSummary[]> {
    return fetch("/registry/apps", { credentials: "include" }).then((r) => json(r));
  },

  getEndpointJson(slug: string): Promise<EndpointJson> {
    return fetch(`/registry/apps/${slug}/endpoint.json`, { credentials: "include" }).then((r) => json(r));
  },

  getMessagesJson(slug: string): Promise<MessagesJson> {
    return fetch(`/registry/apps/${slug}/messages.json`, { credentials: "include" }).then((r) => json(r));
  },

  getAppStatus(slug: string): Promise<AppStatus> {
    return fetch(`/orchestrator/apps/${slug}/status`, { credentials: "include" }).then((r) => json(r));
  },

  lifecycle(slug: string, action: "install" | "start" | "stop" | "restart" | "upgrade"): Promise<{ ok: true }> {
    return fetch(`/orchestrator/apps/${slug}/${action}`, { method: "POST", credentials: "include" }).then((r) =>
      json(r),
    );
  },

  removeApp(slug: string): Promise<{ ok: true }> {
    return fetch(`/orchestrator/apps/${slug}`, { method: "DELETE", credentials: "include" }).then((r) => json(r));
  },

  /**
   * "Try it" — calls an app's endpoint through the gateway proxy. Body is
   * sent as JSON; the raw response text is returned for display.
   */
  async tryEndpoint(
    slug: string,
    method: string,
    path: string,
    body?: string,
  ): Promise<{ status: number; body: string }> {
    const res = await fetch(`/apps/${slug}${path}`, {
      method,
      credentials: "include",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body || undefined,
    });
    return { status: res.status, body: await res.text() };
  },
};
