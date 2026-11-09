import type { EndpointJson, RegistryAppSummary } from "./types.js";

export interface CliContext {
  gatewayUrl: string;
  apiKey?: string;
  workspaceId?: string;
  spaceIds?: string[];
}

function authHeaders(ctx: CliContext): Record<string, string> {
  const headers: Record<string, string> = {};
  if (ctx.apiKey) headers["x-api-key"] = ctx.apiKey;
  if (ctx.workspaceId) headers["x-twodb-workspace-id"] = ctx.workspaceId;
  if (ctx.spaceIds?.length) headers["x-twodb-space-ids"] = ctx.spaceIds.join(",");
  return headers;
}

/** TwoDB's registry (see apps/twodb/ENDPOINTS.md) lists every registered app. */
export async function fetchRegistryApps(ctx: CliContext): Promise<RegistryAppSummary[]> {
  const res = await fetch(new URL("/registry/apps", ctx.gatewayUrl), { headers: authHeaders(ctx) });
  if (!res.ok) throw new Error(`failed to fetch registry: ${res.status} ${await res.text()}`);
  return res.json() as Promise<RegistryAppSummary[]>;
}

export async function fetchAppManifest(ctx: CliContext, slug: string): Promise<EndpointJson> {
  const res = await fetch(new URL(`/registry/apps/${slug}/endpoint.json`, ctx.gatewayUrl), {
    headers: authHeaders(ctx),
  });
  if (!res.ok) throw new Error(`failed to fetch manifest for ${slug}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<EndpointJson>;
}

export interface CallOptions {
  method: string;
  /** App-relative path, already param-substituted, e.g. "/threads/abc123". */
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  streaming?: boolean;
  basePath: string;
}

/** Calls an endpoint through the Gateway. Streaming responses are yielded chunk by chunk. */
export async function callEndpoint(ctx: CliContext, opts: CallOptions): Promise<Response> {
  const url = new URL(opts.basePath.replace(/\/$/, "") + opts.path, ctx.gatewayUrl);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  return fetch(url, {
    method: opts.method,
    headers: {
      ...authHeaders(ctx),
      ...(opts.body ? { "content-type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}
