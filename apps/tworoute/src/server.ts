import Fastify from "fastify";
import { createPgDb } from "@twodb/core-data/db";
import { createAsyncEngine } from "@twodb/core-async/engine";
import {
  INTERNAL_MANIFEST_PATH,
  REGISTRATION_TOKEN_HEADER,
  handleManifestRequest,
} from "@twodb/core-platform/manifest";
import { tworouteManifest } from "./manifest.js";
import type { TwoRouteConfig } from "./config.js";
import { applySchema, type TwoRouteDb } from "./db/schema.js";
import { createConnectionsRepo } from "./db/repository.js";
import { getProvider } from "./providers/index.js";
import { readForwardedContext } from "./gateway-context.js";

export async function buildServer(config: TwoRouteConfig) {
  const app = Fastify({ logger: true });
  const db = createPgDb<TwoRouteDb>({ connectionString: config.DATABASE_URL, schema: "tworoute" });
  await applySchema(db);
  const connections = createConnectionsRepo(db, config.TWODB_DATA_KEY ?? config.TWODB_PROVISION_TOKEN);

  const asyncEngine = createAsyncEngine({ connectionString: config.DATABASE_URL, schema: "tworoute" });
  await asyncEngine.init();

  // Pull-registration endpoint: TwoDB's orchestrator polls this on the
  // container's published port and completes registration itself (see
  // core-platform/src/manifest/serve.ts for why both push and pull exist).
  app.get(INTERNAL_MANIFEST_PATH, async (req, reply) => {
    const res = handleManifestRequest(
      tworouteManifest,
      { registrationToken: config.TWODB_PROVISION_TOKEN, httpUrl: config.HTTP_URL },
      req.headers[REGISTRATION_TOKEN_HEADER],
    );
    return reply.code(res.status).send(res.body);
  });

  app.post("/connections", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as {
      spaceId: string;
      name: string;
      provider: string;
      baseUrl: string;
      apiKey: string;
      defaultModel?: string;
    };

    const existing = await connections.getByName(ctx.workspaceId, body.name);
    if (existing) return reply.code(409).send({ error: `a connection named "${body.name}" already exists` });

    const row = await connections.create({
      workspaceId: ctx.workspaceId,
      spaceId: body.spaceId,
      name: body.name,
      provider: body.provider,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      defaultModel: body.defaultModel,
    });
    return { id: row.id };
  });

  app.get("/connections", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    // No space filter (workspace API keys, or a session with all spaces
    // active) means workspace-wide visibility — not "a space literally
    // named after the workspace".
    const rows = ctx.spaceIds.length
      ? await connections.listForSpaces(ctx.spaceIds)
      : await connections.listForWorkspace(ctx.workspaceId);
    return rows.map((r) => ({
      id: r.id,
      spaceId: r.space_id,
      name: r.name,
      provider: r.provider,
      baseUrl: r.base_url,
      defaultModel: r.default_model,
      createdAt: r.created_at,
    }));
  });

  app.patch("/connections/:id", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const existing = await connections.get(id);
    if (!existing || existing.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "not found" });
    }
    const body = req.body as { name?: string; baseUrl?: string; defaultModel?: string | null; apiKey?: string };
    await connections.update(id, body);
    return { ok: true };
  });

  app.delete("/connections/:id", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const existing = await connections.get(id);
    if (!existing || existing.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "not found" });
    }
    await connections.remove(id);
    return { ok: true };
  });

  // Smoke-test a connection without burning a real completion: lists models
  // when the provider supports it (which itself validates the key), else
  // falls back to a minimal completion.
  app.post("/connections/:id/test", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const connection = await connections.get(id);
    if (!connection || connection.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "not found" });
    }

    const provider = getProvider(connection.provider);
    if (provider.listModels) {
      const models = await provider.listModels(connection);
      if (models) return { ok: true, via: "models", modelCount: models.length };
    }

    const model = connection.default_model;
    if (!model) {
      return reply.code(422).send({ error: "provider can't list models and this connection has no defaultModel to test with" });
    }
    const res = await provider.streamCompletion(connection, {
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      stream: false,
    });
    return { ok: res.ok, via: "completion", upstreamStatus: res.status };
  });

  app.get("/connections/:id/models", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const connection = await connections.get(id);
    if (!connection || connection.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "not found" });
    }
    const provider = getProvider(connection.provider);
    const models = provider.listModels ? await provider.listModels(connection) : null;
    if (!models) {
      return reply.code(422).send({ error: "provider doesn't support model listing — enter a model name manually" });
    }
    return { models };
  });

  app.get("/usage", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const days = Math.min(Number((req.query as { days?: string }).days ?? 7) || 7, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const rows = await connections.usageSummary(ctx.workspaceId, since);
    return { since, days, rows };
  });

  app.post("/completions", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });

    const body = req.body as {
      connectionId?: string;
      /** Convenience for CLI/tests: name is unique per workspace, so it resolves unambiguously. */
      connectionName?: string;
      model: string;
      messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      stream?: boolean;
      temperature?: number;
      max_tokens?: number;
    };

    const visible = ctx.spaceIds.length
      ? await connections.listForSpaces(ctx.spaceIds)
      : await connections.listForWorkspace(ctx.workspaceId);
    const connection = body.connectionId
      ? await connections.get(body.connectionId)
      : body.connectionName
        ? await connections.getByName(ctx.workspaceId, body.connectionName)
        : visible[0]
          ? await connections.get(visible[0].id)
          : undefined;

    if (!connection || connection.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "no LLM connection available for this space" });
    }

    const provider = getProvider(connection.provider);
    const started = Date.now();

    // Non-streaming callers get a plain JSON response (plus usage logging) —
    // streaming requests stay raw pass-through below.
    if (!body.stream) {
      const upstream = await provider.streamCompletion(connection, { ...body, stream: false });
      const text = await upstream.text();
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      try {
        const json = JSON.parse(text) as { usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number } };
        inputTokens = json.usage?.prompt_tokens ?? json.usage?.input_tokens ?? null;
        outputTokens = json.usage?.completion_tokens ?? json.usage?.output_tokens ?? null;
      } catch {
        // Non-JSON error body from upstream — pass through as-is.
      }
      const status = upstream.ok ? ("ok" as const) : ("error" as const);
      await connections.logUsage({
        connectionId: connection.id,
        workspaceId: ctx.workspaceId,
        model: body.model,
        status,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - started,
      });
      // Broadcast the usage event on this schema's bus (fire-and-forget —
      // a broadcast failure must never break a completion).
      void asyncEngine.broadcast
        .publish("llm.completion.recorded", {
          connectionId: connection.id,
          model: body.model,
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - started,
          status,
        })
        .catch(() => {});
      return reply.code(upstream.status).type("application/json").send(text);
    }

    const upstream = await provider.streamCompletion(connection, body);

    reply.raw.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      reply.raw.setHeader(key, value);
    });

    if (!upstream.body) {
      reply.raw.end();
      return;
    }
    reply.hijack();
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }
    } finally {
      reply.raw.end();
    }
  });

  app.get("/healthz", async () => ({ ok: true }));

  app.addHook("onClose", async () => {
    await asyncEngine.close();
  });

  return app;
}
