import { createDialer, pickTransport } from "@twodb/core-platform/transport";
import type { AuthContext } from "@twodb/core-platform/auth";
import type { RegistryRepo } from "../db/registry.js";

const GATEWAY_HOST_ID = process.env.TWODB_HOST_ID ?? "local";

export interface FederatedSearchResult {
  app: string;
  results: unknown[];
  error?: string;
}

/**
 * Fans a query out to every app that declared the `search` capability in
 * its manifest (v1 search approach — no centralized index, see decision
 * log). Each app is expected to expose one endpoint tagged
 * `capability: "search"` in its manifest; we call it with the same
 * resolved AuthContext as any other proxied request.
 */
export async function federatedSearch(
  registry: RegistryRepo,
  ctx: AuthContext,
  query: string,
): Promise<FederatedSearchResult[]> {
  const apps = await registry.listAppsWithCapability("search");

  const settled = await Promise.allSettled(
    apps.map(async (app): Promise<FederatedSearchResult> => {
      const manifest = JSON.parse(app.manifest_json) as {
        basePath: string;
        endpoints: Array<{ path: string; method: string; capability?: string }>;
      };
      const searchEndpoint = manifest.endpoints.find((e) => e.capability === "search");
      if (!searchEndpoint) return { app: app.slug, results: [] };

      const target = pickTransport({
        gatewayHostId: GATEWAY_HOST_ID,
        appHostId: app.host_id,
        appHttpUrl: app.http_url,
        appSocketPath: app.socket_path ?? undefined,
      });
      const dialer = createDialer(target);

      const headers = new Headers();
      headers.set("content-type", "application/json");
      headers.set("x-twodb-auth-kind", ctx.kind);
      if (ctx.userId) headers.set("x-twodb-user-id", ctx.userId);
      headers.set("x-twodb-workspace-id", ctx.workspaceId);
      if (ctx.spaceIds.length) headers.set("x-twodb-space-ids", ctx.spaceIds.join(","));

      const res = await dialer.fetch(searchEndpoint.path, {
        method: searchEndpoint.method,
        headers,
        body: JSON.stringify({ query, workspaceId: ctx.workspaceId, spaceIds: ctx.spaceIds }),
      });

      if (!res.ok) return { app: app.slug, results: [], error: `${res.status}` };
      const body = (await res.json()) as { results?: unknown[] };
      return { app: app.slug, results: body.results ?? [] };
    }),
  );

  return settled.map((s, i) =>
    s.status === "fulfilled" ? s.value : { app: apps[i].slug, results: [], error: String(s.reason) },
  );
}
