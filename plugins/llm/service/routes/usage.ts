import type { FastifyPluginAsync } from "fastify";
import type { TwodbUsageSnapshot } from "@twodb/contracts";
import { adapters } from "../adapters";
import { loadConnection, scope } from "../lib/request";
import type { RouteDeps } from "../lib/types";

type CacheEntry = { snapshot: TwodbUsageSnapshot; fetchedAt: number };

// honors each tracker's ttlMs — usage endpoints are usually heavily rate-limited upstream
const cache = new Map<string, CacheEntry>();

export function usageRoutes(deps: RouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { id: string } }>("/connections/:id/usage", async (request, reply) => {
      const s = await scope(deps, request, reply);
      if (!s) return reply;

      const connection = await loadConnection(deps.kysely, request.params.id, s.workspaceId);
      if (!connection) return reply.code(404).send({ error: "connection_not_found" });

      const adapter = adapters.get(connection.provider) ?? null;
      const tracker = adapter?.usage;
      if (!tracker) return reply.code(501).send({ error: "usage_tracking_unsupported", provider: connection.provider });

      const cached = cache.get(connection.id);
      if (cached && Date.now() - cached.fetchedAt < tracker.ttlMs) {
        return { connection_id: connection.id, fetched_at: new Date(cached.fetchedAt).toISOString(), cached: true, usage: cached.snapshot };
      }

      try {
        const snapshot = await tracker.fetch({
          connectionId: connection.id,
          config: connection.config ?? {},
        });
        cache.set(connection.id, { snapshot, fetchedAt: Date.now() });
        return { connection_id: connection.id, fetched_at: new Date().toISOString(), cached: false, usage: snapshot };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const notImplemented = message === "not_implemented";
        reply.code(notImplemented ? 501 : 502).send({ error: notImplemented ? "not_implemented" : "usage_fetch_failed", detail: message });
        return reply;
      }
    });
  };
}
