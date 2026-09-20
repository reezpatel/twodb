import type { FastifyPluginAsync } from "fastify";
import { adapters } from "../adapters";
import { readSettings } from "../db";
import { loadConnection, scope } from "../lib/request";
import { coerceGovernance, effectiveContextTokens, resolveModelTuning } from "../settings";
import { governanceSnapshot } from "../governor";
import type { RouteDeps } from "../lib/types";

export function tuningRoutes(deps: RouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { id: string } }>("/connections/:id/tuning", async (request, reply) => {
      const s = await scope(deps, request, reply);
      if (!s) return reply;

      const modelId = (request.query as { model?: string }).model;
      if (!modelId) return reply.code(400).send({ error: "model_required" });

      const connection = await loadConnection(deps.kysely, request.params.id, s.workspaceId);
      if (!connection) return reply.code(404).send({ error: "connection_not_found" });

      const adapter = adapters.get(connection.provider) ?? null;
      const model = adapter?.models.find((candidate) => candidate.id === modelId);
      if (!model) return reply.code(404).send({ error: "model_not_found" });

      const settings = await readSettings(deps.kysely, s.workspaceId);
      const resolved = resolveModelTuning(settings, connection, modelId);
      return {
        connection_id: connection.id,
        model: modelId,
        context_window: model.context_window,
        effective_context_window_percent: resolved.effective_context_window_percent,
        effective_context_tokens: effectiveContextTokens(model, resolved.effective_context_window_percent),
        truncation_policy: resolved.truncation_policy,
      };
    });

    app.get<{ Params: { id: string } }>("/connections/:id/governance", async (request, reply) => {
      const s = await scope(deps, request, reply);
      if (!s) return reply;

      const connection = await loadConnection(deps.kysely, request.params.id, s.workspaceId);
      if (!connection) return reply.code(404).send({ error: "connection_not_found" });

      const governance = coerceGovernance((connection.overrides as { governance?: unknown } | null)?.governance) ?? {};
      return { governance, runtime: governanceSnapshot(connection.id, governance) };
    });
  };
}
