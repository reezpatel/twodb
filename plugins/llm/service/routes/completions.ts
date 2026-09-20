import type { FastifyPluginAsync } from "fastify";
import type { TwodbCompletionRequest } from "@twodb/contracts";
import { adapters } from "../adapters";
import { readSettings } from "../db";
import { loadConnection, scope } from "../lib/request";
import { coerceGovernance } from "../settings";
import { acquire } from "../governor";
import type { RouteDeps } from "../lib/types";

export function completionRoutes(deps: RouteDeps): FastifyPluginAsync {
  return async (app) => {
    const prepare = async (
      request: { params: { id: string }; body: unknown },
      reply: {
        code: (code: number) => { send: (payload: unknown) => unknown };
      },
      workspaceId: string,
    ) => {
      const connection = await loadConnection(deps.kysely, request.params.id, workspaceId);
      if (!connection) {
        reply.code(404).send({ error: "connection_not_found" });
        return null;
      }
      if (!connection.enabled) {
        reply.code(409).send({ error: "connection_disabled" });
        return null;
      }

      const adapter = adapters.get(connection.provider) ?? null;
      if (!adapter) {
        reply.code(501).send({ error: "provider_adapter_missing", provider: connection.provider });
        return null;
      }

      const completionRequest = (request.body as { request?: TwodbCompletionRequest } | undefined)?.request;
      if (!completionRequest || !Array.isArray(completionRequest.messages)) {
        reply.code(400).send({ error: "invalid_request" });
        return null;
      }

      const settings = await readSettings(deps.kysely, workspaceId);
      const governance = coerceGovernance((connection.overrides as { governance?: unknown } | null)?.governance) ?? {};
      const lease = await acquire(connection.id, governance, settings.queue.max_wait_ms);
      if (!lease.ok) {
        reply.code(429).send({ error: "limit_exceeded", reason: lease.reason, retry_after_ms: lease.retry_after_ms });
        return null;
      }

      return { connection, adapter, completionRequest, lease };
    };

    app.post<{ Params: { id: string } }>("/connections/:id/completions", async (request, reply) => {
      const s = await scope(deps, request, reply);
      if (!s) return reply;

      const ready = await prepare(request, reply, s.workspaceId);
      if (!ready) return reply;
      const { connection, adapter, completionRequest, lease } = ready;

      try {
        const response = await adapter.completions.complete(completionRequest, {
          connectionId: connection.id,
          config: connection.config ?? {},
        });
        lease.addUsage(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0);
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const notImplemented = message === "not_implemented";
        reply.code(notImplemented ? 501 : 502).send({
          error: notImplemented ? "not_implemented" : "provider_error",
          detail: message,
        });
        return reply;
      } finally {
        lease.release();
      }
    });

    app.post<{ Params: { id: string } }>("/connections/:id/completions/stream", async (request, reply) => {
      const s = await scope(deps, request, reply);
      if (!s) return reply;

      const ready = await prepare(request, reply, s.workspaceId);
      if (!ready) return reply;
      const { connection, adapter, completionRequest, lease } = ready;

      reply.raw.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      try {
        for await (const event of adapter.completions.stream(completionRequest, {
          connectionId: connection.id,
          config: connection.config ?? {},
        })) {
          if (event.type === "usage") {
            lease.addUsage(event.usage.input_tokens, event.usage.output_tokens);
          }
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reply.raw.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
      } finally {
        lease.release();
      }
      reply.raw.end();
      return reply;
    });
  };
}
