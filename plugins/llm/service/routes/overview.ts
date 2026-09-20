import type { FastifyPluginAsync } from "fastify";
import type { LlmOverview } from "../../shared/api";
import { adapters } from "../adapters";
import { readSettings } from "../db";
import { scope } from "../lib/request";
import { connectionDto } from "../lib/transform";
import type { RouteDeps } from "../lib/types";

export function overviewRoutes(deps: RouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.get("/overview", async (request, reply) => {
      const s = await scope(deps, request, reply);
      if (!s) return reply;

      const [settings, connections] = await Promise.all([
        readSettings(deps.kysely, s.workspaceId),
        deps.kysely.selectFrom("llm_connections").selectAll().where("workspace_id", "=", s.workspaceId).orderBy("created_at").execute(),
      ]);
      const overview: LlmOverview = {
        settings,
        connections: connections.map(connectionDto),
        providers: [...adapters.values()].map((adapter) => ({ id: adapter.providerId, name: adapter.displayName, models: adapter.models })),
      };
      return overview;
    });
  };
}
