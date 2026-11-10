import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
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
import { encryptSecret } from "./crypto.js";
import { getProvider, PROVIDERS, getProviderSpec } from "./providers/index.js";
import { readForwardedContext } from "./gateway-context.js";
import { refreshConnectionModels, refreshConnectionQuotas, hasQuotaCollector } from "./lib/model-quota.js";
import { ensureFreshTokens, OAUTH_PROVIDERS } from "./lib/token-refresh.js";
import { startClaudeOAuth, pollClaudeOAuth, completeClaudeOAuth } from "./lib/claude-oauth.js";
import { startCodexOAuth, pollCodexOAuth, completeCodexOAuth } from "./lib/codex-oauth.js";
import { joinUrl } from "./providers/url.js";

export async function buildServer(config: TwoRouteConfig) {
  const app = Fastify({ logger: true });
  // Preserve non-JSON request bodies as raw Buffers (audio uploads are
  // multipart/form-data) so pass-through routes forward them byte-for-byte —
  // same parser setup as the Gateway itself.
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  const db = createPgDb<TwoRouteDb>({ connectionString: config.DATABASE_URL, schema: "tworoute" });
  await applySchema(db);
  const connections = createConnectionsRepo(db, config.TWODB_DATA_KEY ?? config.TWODB_PROVISION_TOKEN);
  const quotaCtx = { db, encrypt: (s: string) => encryptSecret(s, config.TWODB_DATA_KEY ?? config.TWODB_PROVISION_TOKEN) };

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

  // --- Provider catalog (UI builds its forms from this) -------------------
  app.get("/providers", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    return PROVIDERS;
  });

  // --- OAuth flows (claude-code, codex) -----------------------------------
  app.post("/oauth/claude-code/start", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    try {
      return await startClaudeOAuth();
    } catch (e) {
      return reply.code(502).send({ error: "oauth_start_failed", detail: (e as Error).message });
    }
  });

  app.post("/oauth/claude-code/poll", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as { state?: string };
    if (!body?.state) return reply.code(400).send({ error: "invalid_state" });
    return pollClaudeOAuth(body.state);
  });

  app.post("/oauth/claude-code/complete", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as { input?: string };
    if (!body?.input?.trim()) return reply.code(400).send({ error: "invalid_input" });
    return completeClaudeOAuth(body.input);
  });

  app.post("/oauth/codex/start", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    try {
      return await startCodexOAuth();
    } catch (e) {
      return reply.code(502).send({ error: "oauth_start_failed", detail: (e as Error).message });
    }
  });

  app.post("/oauth/codex/poll", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as { state?: string };
    if (!body?.state) return reply.code(400).send({ error: "invalid_state" });
    return pollCodexOAuth(body.state);
  });

  app.post("/oauth/codex/complete", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as { input?: string };
    if (!body?.input?.trim()) return reply.code(400).send({ error: "invalid_input" });
    return completeCodexOAuth(body.input);
  });

  // --- Connections --------------------------------------------------------
  app.post("/connections", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as {
      spaceId: string;
      name: string;
      provider: string;
      baseUrl?: string;
      apiKey?: string;
      defaultModel?: string;
      config?: Record<string, string>;
    };

    const spec = getProviderSpec(body.provider);
    if (!spec) return reply.code(400).send({ error: `unknown provider "${body.provider}"` });
    if (!body.name?.trim()) return reply.code(400).send({ error: "name is required" });

    const existing = await connections.getByName(ctx.workspaceId, body.name.trim());
    if (existing) return reply.code(409).send({ error: `a connection named "${body.name.trim()}" already exists` });

    const row = await connections.create({
      workspaceId: ctx.workspaceId,
      spaceId: body.spaceId,
      name: body.name.trim(),
      provider: body.provider,
      baseUrl: body.baseUrl?.trim() || spec.defaultBaseUrl || "",
      apiKey: body.apiKey ?? "",
      defaultModel: body.defaultModel,
      config: body.config,
    });

    // Seed the model cache right away (static fallback if the provider API fails).
    const live = await connections.getLive(row.id);
    if (live) {
      await refreshConnectionModels(live, connections).catch(() => {
        // model list stays empty; user can refresh manually
      });
    }
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

    const body = req.body as {
      name?: string;
      spaceId?: string;
      baseUrl?: string;
      defaultModel?: string | null;
      apiKey?: string;
      config?: Record<string, string>;
    };

    if (body.name !== undefined && !body.name.trim()) return reply.code(400).send({ error: "invalid name" });
    if (body.spaceId !== undefined && !body.spaceId.trim()) return reply.code(400).send({ error: "invalid spaceId" });

    await connections.update(id, {
      name: body.name?.trim(),
      spaceId: body.spaceId,
      baseUrl: body.baseUrl,
      defaultModel: body.defaultModel,
      apiKey: body.apiKey,
      config: body.config,
    });
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
    const existing = await connections.get(id);
    if (!existing || existing.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "not found" });
    }
    const live = await connections.getLive(id);
    if (!live) return reply.code(404).send({ error: "not found" });

    try {
      let fresh = await ensureFreshTokens(live, db, quotaCtx.encrypt);
      const provider = getProvider(live.provider);
      let models = provider.listModels ? await provider.listModels({ ...live, configParsed: fresh }) : null;
      // Auth-shaped failure with a refresh token on file → one forced refresh
      // (covers imports whose access token is corrupt/truncated while
      // expires_at is still in the future) and retry once.
      if (!models && OAUTH_PROVIDERS.has(live.provider)) {
        try {
          const upstream = await provider.streamCompletion({ ...live, configParsed: fresh }, {
            model: live.default_model ?? "ping",
            messages: [{ role: "user", content: "ping" }],
            stream: false,
            max_tokens: 1,
          });
          if (upstream.status === 401) {
            fresh = await ensureFreshTokens(live, db, quotaCtx.encrypt, { force: true });
            models = provider.listModels ? await provider.listModels({ ...live, configParsed: fresh }) : null;
          }
        } catch {
          // fall through to the defaultModel path below
        }
      }
      if (models) return { ok: true, via: "models", modelCount: models.length };
      if (live.default_model) {
        const upstream = await provider.streamCompletion({ ...live, configParsed: fresh }, {
          model: live.default_model,
          messages: [{ role: "user", content: "ping" }],
          stream: false,
          max_tokens: 1,
        });
        if (upstream.ok) return { ok: true, via: "completion", modelCount: null };
        return reply.code(422).send({ error: `provider returned ${upstream.status}: ${(await upstream.text()).slice(0, 200)}` });
      }
      return reply.code(422).send({ error: "provider can't list models and this connection has no defaultModel to test with" });
    } catch (e) {
      return reply.code(422).send({ error: (e as Error).message });
    }
  });

  // --- Cached models + refresh ---------------------------------------------
  app.get("/connections/:id/models", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const existing = await connections.get(id);
    if (!existing || existing.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "not found" });
    }
    const rows = await connections.listModels(id);
    return {
      models: rows.map((m) => ({
        modelId: m.model_id,
        displayName: m.display_name,
        contextWindow: m.context_window,
        thinking: m.thinking,
        input: JSON.parse(m.input) as string[],
        thinkingLevel: JSON.parse(m.thinking_level) as string[],
        temperature: m.temperature,
        limitContext: m.limit_context,
        limitInput: m.limit_input,
        limitOutput: m.limit_output,
        costInput: m.cost_input,
        costOutput: m.cost_output,
        costCacheRead: m.cost_cache_read,
        output: JSON.parse(m.output) as string[],
      })),
    };
  });

  app.post("/connections/:id/refresh-models", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const live = await connections.getLive(id);
    if (!live || live.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "not found" });
    }
    const result = await refreshConnectionModels(live, connections).catch((e) => {
      return { count: 0, warning: (e as Error).message };
    });
    return result;
  });

  // --- Quotas ---------------------------------------------------------------
  app.get("/quotas", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const rows = await connections.listQuotasForWorkspace(ctx.workspaceId);
    return { quotas: rows.map((q) => ({
      id: q.id,
      connectionId: q.connection_id,
      quotaType: q.quota_type,
      groupName: q.group_name,
      unit: q.unit,
      quotaTotal: q.quota_total,
      quotaUsed: q.quota_used,
      capturedAt: q.captured_at,
      resetAt: q.reset_at,
    })) };
  });

  app.get("/connections/:id/quotas", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const existing = await connections.get(id);
    if (!existing || existing.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "not found" });
    }
    const rows = await connections.listQuotas(id);
    return { quotas: rows.map((q) => ({
      id: q.id,
      connectionId: q.connection_id,
      quotaType: q.quota_type,
      groupName: q.group_name,
      unit: q.unit,
      quotaTotal: q.quota_total,
      quotaUsed: q.quota_used,
      capturedAt: q.captured_at,
      resetAt: q.reset_at,
    })) };
  });

  app.post("/connections/:id/refresh-quotas", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const live = await connections.getLive(id);
    if (!live || live.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "not found" });
    }
    if (!hasQuotaCollector(live.provider)) {
      return reply.code(400).send({ error: "quota_refresh_not_supported", provider: live.provider });
    }
    try {
      const snapshots = await refreshConnectionQuotas(live, connections, quotaCtx);
      if (snapshots.length === 0) return reply.code(502).send({ error: "quota_parse_failed" });
      const rows = await connections.listQuotas(id);
      return { quotas: rows.map(toQuotaJson) };
    } catch (e) {
      return reply.code(502).send({ error: "quota_fetch_failed", detail: (e as Error).message.slice(0, 300) });
    }
  });

  /**
   * POST /connections/refresh-quotas — sweeps EVERY visible connection that
   * has a quota collector, in parallel. Dead credentials fail per-connection
   * (error detail returned inline) without failing the batch.
   */
  app.post("/connections/refresh-quotas", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const visible = ctx.spaceIds.length
      ? await connections.listForSpaces(ctx.spaceIds)
      : await connections.listForWorkspace(ctx.workspaceId);

    const results = await Promise.all(
      visible.map(async (c) => {
        if (!hasQuotaCollector(c.provider)) {
          return { connectionId: c.id, connectionName: c.name, status: "skipped" as const, detail: "no quota collector for this provider" };
        }
        const live = await connections.getLive(c.id);
        if (!live) return { connectionId: c.id, connectionName: c.name, status: "error" as const, detail: "connection not readable" };
        try {
          const snapshots = await refreshConnectionQuotas(live, connections, quotaCtx);
          if (snapshots.length === 0) {
            return { connectionId: c.id, connectionName: c.name, status: "error" as const, detail: "quota_parse_failed" };
          }
          return {
            connectionId: c.id,
            connectionName: c.name,
            status: "ok" as const,
            quotas: snapshots,
          };
        } catch (e) {
          return {
            connectionId: c.id,
            connectionName: c.name,
            status: "error" as const,
            detail: (e as Error).message.slice(0, 300),
          };
        }
      }),
    );

    const quotaRows = await connections.listQuotasForWorkspace(ctx.workspaceId);
    return { results, quotas: quotaRows.map(toQuotaJson) };
  });

  // --- Per-connection usage ------------------------------------------------
  app.get("/connections/:id/usage", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const existing = await connections.get(id);
    if (!existing || existing.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "not found" });
    }
    return connections.usageTotals(id);
  });

  app.get("/usage", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const days = Math.min(Number((req.query as { days?: string }).days ?? 7) || 7, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const rows = await connections.usageSummary(ctx.workspaceId, since);
    return { since, days, rows };
  });

  // --- Analytics (dashboard widgets read these) -----------------------------
  /**
   * 24h summary per (connection, model): calls with completed/failed split,
   * token sums, avg/p95 latency. Cost is joined client-side against cached
   * model prices (llm_model.cost_*) — no rollup tables, one usage_log query.
   */
  app.get("/analytics/summary", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const days = Math.min(Number((req.query as { days?: string }).days ?? 1) || 1, 7);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const connectionId = (req.query as { connectionId?: string }).connectionId;
    const rows = await connections.analyticsSummary(ctx.workspaceId, since, connectionId);
    return { since, days, rows };
  });

  app.get("/analytics/calls", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    // Yearly view: daily call buckets per connection, up to 365 days back.
    const days = Math.min(Number((req.query as { days?: string }).days ?? 365) || 365, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const connectionId = (req.query as { connectionId?: string }).connectionId;
    const buckets = await connections.callsPerDay(ctx.workspaceId, since, connectionId);
    return { since, days, buckets };
  });

  /** Tool invocations grouped per tool (24h by default). */
  app.get("/analytics/tools", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const days = Math.min(Number((req.query as { days?: string }).days ?? 1) || 1, 7);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const connectionId = (req.query as { connectionId?: string }).connectionId;
    const tools = await connections.toolCalls(ctx.workspaceId, since, connectionId);
    return { since, days, tools };
  });

  /**
   * Direct tool-invocation logging for apps that execute tools themselves:
   * one usage row with tool_name set. The invocation itself is the caller's
   * business — this records the fact (name, status, latency, connection).
   */
  app.post("/tools/invoke", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const body = req.body as {
      connectionId?: string;
      connectionName?: string;
      tool: string;
      status?: "ok" | "error";
      latencyMs?: number;
    };
    if (!body?.tool?.trim()) return reply.code(400).send({ error: "tool is required" });
    const connection = await resolveConnection(ctx, body);
    if (!connection) return reply.code(404).send({ error: "no LLM connection available for this space" });

    await connections.logUsage({
      connectionId: connection.id,
      workspaceId: ctx.workspaceId,
      model: body.tool.trim(),
      status: body.status === "error" ? "error" : "ok",
      latencyMs: Math.max(0, Math.round(body.latencyMs ?? 0)),
      toolName: body.tool.trim(),
    });
    return { ok: true };
  });

  async function completionsHandler(req: FastifyRequest, reply: FastifyReply) {
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

    // Model ids from GET /v1/models are "<connection-name>/<model-id>" —
    // a prefix matching a visible connection's name targets it, with the
    // remainder as the upstream model. Explicit connectionId/connectionName
    // still win; otherwise the first visible connection is used.
    let model = body.model;
    let prefixConn: (typeof visible)[number] | undefined;
    for (const c of visible) {
      if (body.model === c.name) continue; // model IS the connection name alone — no split
      if (body.model.startsWith(`${c.name}/`)) {
        prefixConn = c;
        model = body.model.slice(c.name.length + 1);
        break;
      }
    }

    const connection = body.connectionId
      ? await connections.getLive(body.connectionId)
      : body.connectionName
        ? await connections.getByName(ctx.workspaceId, body.connectionName).then((r) => (r ? connections.getLive(r.id) : undefined))
        : prefixConn
          ? await connections.getLive(prefixConn.id)
          : visible[0]
            ? await connections.getLive(visible[0].id)
            : undefined;

    if (!connection || connection.workspace_id !== ctx.workspaceId) {
      return reply.code(404).send({ error: "no LLM connection available for this space" });
    }

    const provider = getProvider(connection.provider);
    const started = Date.now();
    const request = { ...body, model };

    // Non-streaming callers get a plain JSON response (plus usage logging) —
    // streaming requests stay raw pass-through below.
    if (!body.stream) {
      const upstream = await provider.streamCompletion(connection, { ...request, stream: false });
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
        model: request.model,
        status,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - started,
      });
      // Tool calls chosen by the assistant in this completion get their own
      // usage rows (one per tool) — the tool-calls widget reads them.
      if (status === "ok") {
        try {
          const json = JSON.parse(text) as {
            choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: unknown } }> } }>;
          };
          const toolNames = (json.choices ?? [])
            .flatMap((c) => c.message?.tool_calls ?? [])
            .map((tc) => (typeof tc.function?.name === "string" ? tc.function.name : null))
            .filter((n): n is string => !!n);
          const unique = [...new Set(toolNames)];
          for (const tool of unique) {
            await connections
              .logUsage({
                connectionId: connection.id,
                workspaceId: ctx.workspaceId,
                model: request.model,
                status: "ok",
                latencyMs: 0,
                toolName: tool,
              })
              .catch(() => {});
          }
        } catch {
          // not JSON / no choices — nothing to record
        }
      }
      // Broadcast the usage event on this schema's bus (fire-and-forget —
      // a broadcast failure must never break a completion).
      void asyncEngine.broadcast
        .publish("llm.completion.recorded", {
          connectionId: connection.id,
          model: request.model,
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - started,
          status,
        })
        .catch(() => {});
      return reply.code(upstream.status).type("application/json").send(text);
    }

    const upstream = await provider.streamCompletion(connection, request);

    reply.raw.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      reply.raw.setHeader(key, value);
    });

    const status = upstream.ok ? ("ok" as const) : ("error" as const);

    if (!upstream.body) {
      reply.raw.end();
      void connections
        .logUsage({
          connectionId: connection.id,
          workspaceId: ctx.workspaceId,
          model: request.model,
          status,
          latencyMs: Date.now() - started,
        })
        .catch(() => {});
      return;
    }

    // Streamed completions: pass chunks through unbuffered, while scanning
    // SSE `data:` lines for the final usage chunk (OpenAI's
    // stream_options.include_usage / Anthropic's message_delta usage) and
    // streamed tool_call function names. The scan is per-chunk and
    // stateless — SSE frames are line-delimited JSON, and both providers
    // emit usage in a single complete event, so a chunk-boundary split of
    // the payload would only miss metrics, never corrupt the stream.
    const textDecoder = new TextDecoder();
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    const toolNames = new Set<string>();

    reply.hijack();
    const reader = upstream.body.getReader();
    try {
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
        buffer += textDecoder.decode(value, { stream: true });
        // Process only complete lines; carry the remainder.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload) as {
              usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number };
              delta?: { tool_calls?: Array<{ function?: { name?: unknown } }> };
              message?: { usage?: { input_tokens?: number; output_tokens?: number } };
            };
            // OpenAI wire: final usage chunk (or anthropic-style names on
            // openai-compatible providers).
            const u = evt.usage;
            if (u) {
              inputTokens = u.prompt_tokens ?? u.input_tokens ?? inputTokens;
              outputTokens = u.completion_tokens ?? u.output_tokens ?? outputTokens;
            }
            // Anthropic wire: message_delta carries usage.output_tokens; the
            // input count arrives on the message_start event.
            const au = evt.message?.usage;
            if (au) {
              inputTokens = au.input_tokens ?? inputTokens;
              outputTokens = au.output_tokens ?? outputTokens;
            }
            // OpenAI wire: streamed tool calls carry the name on the first
            // delta of each tool_call index.
            for (const tc of evt.delta?.tool_calls ?? []) {
              const name = tc.function?.name;
              if (typeof name === "string" && name) toolNames.add(name);
            }
          } catch {
            // not JSON — ignore
          }
        }
      }
    } finally {
      reply.raw.end();
      // Usage row for the completion itself (tokens now captured from the
      // stream when the provider reports them; still null if it doesn't).
      void connections
        .logUsage({
          connectionId: connection.id,
          workspaceId: ctx.workspaceId,
          model: request.model,
          status,
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - started,
        })
        .catch(() => {});
      // Tool invocations chosen mid-stream get their own rows.
      for (const tool of toolNames) {
        void connections
          .logUsage({
            connectionId: connection.id,
            workspaceId: ctx.workspaceId,
            model: request.model,
            status: "ok",
            latencyMs: 0,
            toolName: tool,
          })
          .catch(() => {});
      }
    }
  }

  app.post("/completions", completionsHandler);

  /** Row → JSON shape shared by every quota-returning route. */
  function toQuotaJson(q: { id: string; connection_id: string; quota_type: string; group_name: string; unit: string; quota_total: number | null; quota_used: number; captured_at: string; reset_at: string | null }) {
    return {
      id: q.id,
      connectionId: q.connection_id,
      quotaType: q.quota_type,
      groupName: q.group_name,
      unit: q.unit,
      quotaTotal: q.quota_total,
      quotaUsed: q.quota_used,
      capturedAt: q.captured_at,
      resetAt: q.reset_at,
    };
  }

  /**
   * Resolves a connection for pass-through routes: explicit id, unique name,
   * or the first visible in-scope. Shared by /completions and /audio/*.
   */
  async function resolveConnection(ctx: { workspaceId: string; spaceIds: string[] }, body: { connectionId?: string; connectionName?: string }) {
    const visible = ctx.spaceIds.length
      ? await connections.listForSpaces(ctx.spaceIds)
      : await connections.listForWorkspace(ctx.workspaceId);
    const connection = body.connectionId
      ? await connections.getLive(body.connectionId)
      : body.connectionName
        ? await connections.getByName(ctx.workspaceId, body.connectionName).then((r) => (r ? connections.getLive(r.id) : undefined))
        : visible[0]
          ? await connections.getLive(visible[0].id)
          : undefined;

    if (!connection || connection.workspace_id !== ctx.workspaceId) return undefined;
    return connection;
  }

  /**
   * POST /audio/transcriptions — OpenAI-compatible audio transcription
   * (Whisper & friends). The multipart body passes through untouched to the
   * picked connection's base_url; any wire is allowed (option 1): an
   * upstream without a transcription API just 404s from the provider.
   * `connectionId`/`connectionName` ride the form fields; everything else
   * (file, model, language, response_format…) is forwarded as-is.
   */
  async function transcriptionsHandler(req: FastifyRequest, reply: FastifyReply) {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });

    const started = Date.now();
    const connectionId = (req.query as { connectionId?: string }).connectionId;
    const connectionName = (req.query as { connectionName?: string }).connectionName;
    const connection = await resolveConnection(ctx, { connectionId, connectionName });
    if (!connection) return reply.code(404).send({ error: "no LLM connection available for this space" });

    // Strip the content-type's boundary? No — forward multipart byte-for-byte,
    // including the original content-type header (boundary included).
    const headers: Record<string, string> = { "content-type": req.headers["content-type"] as string };
    if (connection.configParsed.org && connection.provider === "openai") headers["openai-organization"] = connection.configParsed.org;
    if (connection.api_key) headers.authorization = `Bearer ${connection.api_key}`;
    if (connection.configParsed.accessToken) headers.authorization = `Bearer ${connection.configParsed.accessToken}`;

    const upstream = await fetch(joinUrl(connection.base_url, "/audio/transcriptions"), {
      method: "POST",
      headers,
      body: req.body as Buffer,
    });
    const text = await upstream.text();

    const ok = upstream.ok;
    await connections.logUsage({
      connectionId: connection.id,
      workspaceId: ctx.workspaceId,
      model: "audio-transcription",
      status: ok ? "ok" : "error",
      latencyMs: Date.now() - started,
    }).catch(() => {});

    return reply.code(upstream.status).type(upstream.headers.get("content-type") ?? "application/json").send(text);
  }

  app.post("/audio/transcriptions", transcriptionsHandler);
  app.post("/v1/audio/transcriptions", transcriptionsHandler);

  // --- OpenAI-compatible /v1 aliases: stock SDK clients (openai npm pkg,
  // Cursor, Continue…) point at {gateway}/apps/tworoute/v1 with a TwoDB
  // workspace API key as the apiKey (arrives via Authorization: Bearer —
  // accepted by the Gateway for workspace keys) or x-api-key.
  app.post("/v1/chat/completions", completionsHandler);

  /**
   * GET /v1/models — OpenAI list shape, aggregated across ALL visible
   * connections. Each id is "<connection-name>/<model-id>" (e.g.
   * "kilo/anthropic/claude-opus-4.8" or "openai/gpt-5.2"), so a stock client
   * can both enumerate and target a specific connection by just using the
   * id as the model — /v1/chat/completions resolves the prefix back to the
   * connection.
   */
  app.get("/v1/models", async (req, reply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) return reply.code(401).send({ error: "unauthorized" });
    const visible = ctx.spaceIds.length
      ? await connections.listForSpaces(ctx.spaceIds)
      : await connections.listForWorkspace(ctx.workspaceId);

    const data: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const conn of visible) {
      const rows = await connections.listModels(conn.id);
      for (const m of rows) {
        const id = `${conn.name}/${m.model_id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        data.push({
          id,
          object: "model",
          created: Math.floor(new Date(m.created_at).getTime() / 1000),
          owned_by: conn.provider,
          // Extra (non-OpenAI-standard) properties clients can use:
          connection_name: conn.name,
          provider: conn.provider,
          display_name: m.display_name,
          context_window: m.context_window,
          thinking: m.thinking,
          input_modalities: JSON.parse(m.input) as string[],
          output_modalities: JSON.parse(m.output) as string[],
          temperature: m.temperature,
          max_input_tokens: m.limit_input,
          max_output_tokens: m.limit_output,
          cost_per_million_input: m.cost_input,
          cost_per_million_output: m.cost_output,
          cost_per_million_cache_read: m.cost_cache_read,
        });
      }
    }
    return { object: "list", data };
  });

  app.get("/healthz", async () => ({ ok: true }));

  app.addHook("onClose", async () => {
    await asyncEngine.close();
  });

  return app;
}
