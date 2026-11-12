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
  managed: boolean;
  httpUrl: string;
  capabilities: string[];
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

/** A workspace API key's metadata — rawKey only appears once, at creation. */
export interface ApiKeyMeta {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** A workspace space — the sub-scope that app resources (e.g. TwoRoute
 * connections) link themselves to. */
export interface SpaceMeta {
  id: string;
  name: string;
  createdAt: string | null;
}

/** One row of the static install catalog (orchestrator/catalog.ts), served at
 * /orchestrator/catalog — an app that can be installed but may not be
 * registered yet. */
export interface CatalogEntry {
  slug: string;
  hostPort: number;
}

/** A catalog entry padded into the RegisteredAppSummary shape so it renders in
 * the same grid as registered apps. */
export function catalogEntryToSummary(entry: CatalogEntry): RegisteredAppSummary {
  return {
    slug: entry.slug,
    name: entry.slug,
    basePath: `/${entry.slug}`,
    status: "unknown",
    installStatus: "not_installed",
    version: null,
    managed: true,
    httpUrl: `http://localhost:${entry.hostPort}`,
    capabilities: [],
  };
}

export const gatewayClient = {
  listCatalog(): Promise<CatalogEntry[]> {
    return fetch("/orchestrator/catalog", { credentials: "include" }).then((r) => json(r));
  },

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

  /** Rotate the app's token. Unmanaged → new token (shown once); managed → container is recreated async. */
  rotateToken(slug: string): Promise<{ ok: true; managed: boolean; token?: string; expiresAt?: string | null }> {
    return fetch(`/registry/apps/${slug}/rotate-token`, { method: "POST", credentials: "include" }).then((r) => json(r));
  },

  removeApp(slug: string): Promise<{ ok: true }> {
    return fetch(`/orchestrator/apps/${slug}`, { method: "DELETE", credentials: "include" }).then((r) => json(r));
  },

  /** Register an external (unmanaged) app — URL entry for the gateway, no lifecycle. */
  registerExternalApp(input: { slug: string; name: string; httpUrl: string; basePath?: string }): Promise<{ ok: true }> {
    return fetch("/registry/apps/external", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    }).then((r) => json(r));
  },

  /** A workspace API key's metadata (the raw secret only appears once at creation). */
  listApiKeys(): Promise<{ keys: ApiKeyMeta[] }> {
    return fetch("/registry/api-keys", { credentials: "include" }).then((r) => json(r));
  },

  createApiKey(name: string): Promise<{ key: ApiKeyMeta; rawKey: string }> {
    return fetch("/registry/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    }).then((r) => json(r));
  },

  revokeApiKey(id: string): Promise<{ ok: true }> {
    return fetch(`/registry/api-keys/${id}`, { method: "DELETE", credentials: "include" }).then((r) => json(r));
  },

  listSpaces(): Promise<{ spaces: SpaceMeta[] }> {
    return fetch("/registry/spaces", { credentials: "include" }).then((r) => json(r));
  },

  createSpace(name: string): Promise<{ space: { id: string; name: string } }> {
    return fetch("/registry/spaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    }).then((r) => json(r));
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
