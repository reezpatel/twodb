import type { FastifyPluginAsync } from "fastify";
import { newId } from "@twodb/shared-backend";
import type { CreateLlmConnectionRequest, UpdateLlmConnectionRequest } from "../../shared/api";
import { adapters } from "../adapters";
import { coerceGovernance } from "../settings";
import { scope } from "../lib/request";
import { cleanText, connectionDto, isRecord } from "../lib/transform";
import type { RouteDeps } from "../lib/types";

export function connectionRoutes(deps: RouteDeps): FastifyPluginAsync {
  return async (app) => {
    app.post("/connections", async (request, reply) => {
      const s = await scope(deps, request, reply);
      if (!s) return reply;

      const body = (request.body ?? {}) as Partial<CreateLlmConnectionRequest>;
      const provider = cleanText(body.provider, 200);
      const name = cleanText(body.name, 80);
      const config = isRecord(body.config) ? body.config : {};
      if (!provider || !name) return reply.code(400).send({ error: "invalid_provider_or_name" });
      if (!adapters.has(provider)) return reply.code(400).send({ error: "unknown_provider", provider });

      const row = await deps.kysely
        .insertInto("llm_connections")
        .values({ id: newId("llmc"), workspace_id: s.workspaceId, provider, name, config: config as Record<string, unknown> })
        .returningAll()
        .executeTakeFirstOrThrow();
      return connectionDto(row);
    });

    app.patch<{ Params: { id: string } }>("/connections/:id", async (request, reply) => {
      const s = await scope(deps, request, reply);
      if (!s) return reply;

      const body = (request.body ?? {}) as UpdateLlmConnectionRequest;
      const patch: Partial<{
        name: string;
        config: Record<string, unknown>;
        overrides: Record<string, unknown> | null;
        enabled: boolean;
        updated_at: Date;
      }> = {};
      if (body.name !== undefined) {
        const name = cleanText(body.name, 80);
        if (!name) return reply.code(400).send({ error: "invalid_name" });
        patch.name = name;
      }
      if (body.config !== undefined) {
        if (!isRecord(body.config)) return reply.code(400).send({ error: "invalid_config" });
        patch.config = body.config;
      }
      if (body.overrides !== undefined) {
        if (body.overrides !== null && !isRecord(body.overrides)) return reply.code(400).send({ error: "invalid_overrides" });
        const overrides = { ...(body.overrides as Record<string, unknown>) };
        if ("governance" in overrides) {
          const governance = coerceGovernance(overrides.governance);
          if (overrides.governance !== undefined && governance === undefined) {
            return reply.code(400).send({ error: "invalid_governance" });
          }
          if (governance === undefined) delete overrides.governance;
          else overrides.governance = governance;
        }
        patch.overrides = Object.keys(overrides).length > 0 ? overrides : null;
      }
      if (body.enabled !== undefined) patch.enabled = body.enabled;
      if (Object.keys(patch).length === 0) return reply.code(400).send({ error: "empty_update" });

      const row = await deps.kysely
        .updateTable("llm_connections")
        .set({ ...patch, updated_at: new Date() })
        .where("id", "=", request.params.id)
        .where("workspace_id", "=", s.workspaceId)
        .returningAll()
        .executeTakeFirst();
      if (!row) return reply.code(404).send({ error: "connection_not_found" });
      return connectionDto(row);
    });

    app.delete<{ Params: { id: string } }>("/connections/:id", async (request, reply) => {
      const s = await scope(deps, request, reply);
      if (!s) return reply;

      const row = await deps.kysely
        .deleteFrom("llm_connections")
        .where("id", "=", request.params.id)
        .where("workspace_id", "=", s.workspaceId)
        .returning("id")
        .executeTakeFirst();
      if (!row) return reply.code(404).send({ error: "connection_not_found" });
      return { ok: true };
    });
  };
}
