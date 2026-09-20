import type { FastifyPluginAsync } from "fastify";
import type { UpdateLlmWorkspaceSettingsRequest } from "../../shared/api";
import { readSettings } from "../db";
import { scope } from "../lib/request";
import type { RouteDeps } from "../lib/types";

export function settingsRoutes(deps: RouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.patch("/settings", async (request, reply) => {
      const s = await scope(deps, request, reply);
      if (!s) return reply;

      const current = await readSettings(deps.kysely, s.workspaceId);
      const body = (request.body ?? {}) as UpdateLlmWorkspaceSettingsRequest;

      const percent = body.effective_context_window_percent ?? current.effective_context_window_percent;
      if (!Number.isFinite(percent) || percent < 10 || percent > 100) {
        return reply.code(400).send({ error: "invalid_context_window_percent" });
      }

      const policy = body.truncation_policy ?? current.truncation_policy;
      const dm = body.default_model !== undefined ? body.default_model : current.default_model;

      const maxWaitRaw = body.queue?.max_wait_ms ?? current.queue.max_wait_ms;
      if (!Number.isInteger(maxWaitRaw) || maxWaitRaw < 0 || maxWaitRaw > 600_000) {
        return reply.code(400).send({ error: "invalid_queue_max_wait_ms" });
      }
      const queue = { max_wait_ms: maxWaitRaw };

      await deps.kysely
        .insertInto("llm_workspace_settings")
        .values({
          workspace_id: s.workspaceId,
          effective_context_window_percent: percent,
          truncation_policy: policy as unknown as Record<string, unknown>,
          default_model: (dm ?? null) as unknown as Record<string, unknown> | null,
          queue,
        })
        .onConflict((oc) =>
          oc.column("workspace_id").doUpdateSet({
            effective_context_window_percent: percent,
            truncation_policy: policy as unknown as Record<string, unknown>,
            default_model: (dm ?? null) as unknown as Record<string, unknown> | null,
            queue,
          }),
        )
        .execute();
      return { ok: true };
    });
  };
}
