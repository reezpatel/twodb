import Fastify from "fastify";
import { BODY_LIMIT, webappRewriteUrl, registerWebapp, webappDist } from "@twodb/twodb-core/webapp";
import websocket from "@fastify/websocket";
import { WebSocket } from "ws";
import { createPgDb } from "@twodb/core-data/db";
import { createAsyncEngine } from "@twodb/core-async/engine";
import { createRelay } from "@twodb/core-async/relay";
import { createInboxHandler, serviceDeliver, type TwoDbRuntime } from "@twodb/twodb-core";
import { createCollabService } from "./collab/service.js";
import { CANCEL_JOB, ROLLBACK_JOB, RUN_JOB, type CancelPayload, type RollbackPayload, type RunPayload } from "./collab/types.js";

import { applySchema } from "./db/schema.js";
import { memoryTools } from "./ws/tools/memory.js";
import { isLevel, normalizeContent, normalizeTitle, resolveMemoryContext, sessionMemories, titleTaken } from "./memory.js";
import { createArtisanRepo, newId } from "./db/repository.js";
import { loadArtisanConfig, type ArtisanConfig } from "./config.js";
import { gunzipSync } from "node:zlib";
import { readForwardedContext } from "./gateway-context.js";
import { artisanManifest } from "./manifest.js";
import { TworouteClient } from "./tworoute-client.js";
import { DispatchClient, MICROVM_PREFIX } from "./dispatch-client.js";
import { WorkspaceHub } from "./ws/hub.js";
import { registerWorkspaceWs } from "./ws/workspace-ws.js";
import { scopeOf, validateScope, type SkillMode, type SkillScope } from "./skills.js";
import { MCP_TRANSPORTS, NAME_RE, mcpScopeOf, parseHeaders, parseMcpServersJson, validateMcpScope, validUrl, type McpMode, type McpScope } from "./mcp.js";
import { createToolkitClient } from "./toolkit-client.js";
import type { McpServerRow, MemoryRow, SkillRow } from "./db/schema.js";
import { canvasTools, listCanvasContent } from "./canvas.js";
import { toolkitTools } from "./ws/tools/toolkit.js";
import { isSessionRunning, fileTools, type RunDeps } from "./ws/agent-loop.js";
import { SessionRunner, type RunCredentials } from "./ws/session-runner.js";
import { subagentTools } from "./ws/tools/subagents.js";
import { askUserTool } from "./ws/tools/ask-user.js";
import { runCompaction } from "./ws/compaction.js";
import { QuotaClient } from "./quota-client.js";
import type { FastifyReply, FastifyRequest } from "fastify";

/** How long inspector request snapshots are kept. */
export const INSPECT_RETENTION_DAYS = 3;

/** What the server needs from the control-plane session to talk to other apps. */
export type ServiceCaller = Pick<TwoDbRuntime, "serviceFetch" | "verifyServiceToken" | "serviceToken" | "actAs">;

export async function buildServer(config: ArtisanConfig, opts: { twodb?: ServiceCaller } = {}) {
  const app = Fastify({ rewriteUrl: webappRewriteUrl, logger: true, bodyLimit: BODY_LIMIT });
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  await app.register(websocket);

  const db = createPgDb<{ tables: never }>({ connectionString: config.DATABASE_URL, schema: "artisan" }) as never;
  await applySchema(db as never); // tables first: the collab sync / workers below query them
  const HOP_BY_HOP = new Set([
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "trailer",
    "upgrade",
    "proxy-authenticate",
    "proxy-authorization",
    "content-length",
  ]);
  const repo = createArtisanRepo(db as never);
  const hub = new WorkspaceHub();

  // --- chat collaborators: durable messaging with TwoChat ----------------------
  // Everything below is skipped when the server runs without a control-plane session (tests).
  const collabCleanup: Array<() => Promise<void> | void> = [];
  const collab = opts.twodb
    ? await (async () => {
        const twodb = opts.twodb!;
        const engine = createAsyncEngine({ connectionString: config.DATABASE_URL, schema: "artisan" });
        await engine.init();
        const relay = createRelay({ engine, deliver: serviceDeliver(twodb), concurrency: 4 });
        const svc = createCollabService({
          db: db as never,
          repo,
          hub,
          config,
          relay,
          serviceFetch: twodb.serviceFetch,
          actAs: twodb.actAs,
          log: { info: (o, m) => app.log.info(o as object, m), warn: (o, m) => app.log.warn(o as object, m), error: (o, m) => app.log.error(o as object, m) },
        });
        const inbox = createInboxHandler({
          caller: twodb,
          receive: async (input) => {
            await svc.beforeReceive(input.type, input.workspaceId, input.payload);
            return relay.receive(input);
          },
          accepts: {
            [RUN_JOB]: { maxAttempts: 1, leaseMs: 60_000 }, // never blindly retried: a re-run repeats side effects
            [CANCEL_JOB]: { maxAttempts: 3 },
            [ROLLBACK_JOB]: { maxAttempts: 3 },
          },
        });
        app.post("/_svc/inbox", { bodyLimit: 8 * 1024 * 1024 }, async (req, reply) => {
          const r = await inbox(req.headers as { authorization?: string }, req.body);
          return reply.code(r.status).send(r.body);
        });

        relay.start();
        engine.queue.onDead([RUN_JOB], (job, error) => svc.onRunDead(job.payload, error));
        const runWorker = engine.queue.worker([RUN_JOB], async (job) => svc.runJob(job.payload as RunPayload), { concurrency: 4, pollIntervalMs: 500 });
        const ctlWorker = engine.queue.worker(
          [CANCEL_JOB, ROLLBACK_JOB],
          async (job) => {
            if (job.type === CANCEL_JOB) await svc.cancelRun(job.payload as CancelPayload);
            else await svc.rollback(job.payload as RollbackPayload);
          },
          { concurrency: 2, pollIntervalMs: 300 },
        );
        const sweep = setInterval(() => void svc.failStaleRuns().catch(() => undefined), 60_000);
        sweep.unref();
        void svc
          .syncAllBots()
          .then((n) => {
            if (n) app.log.info(`collab: synced ${n} collaborator(s) to TwoChat`);
          })
          .catch((err) => app.log.warn({ err }, "collab bot sync failed"));
        collabCleanup.push(
          () => clearInterval(sweep),
          () => relay.stop(),
          () => runWorker.stop(),
          () => ctlWorker.stop(),
          () => engine.close(),
        );
        return svc;
      })()
    : null;
  app.addHook("onClose", async () => {
    for (const c of collabCleanup) await c();
  });

  // Inspector snapshots are short-lived: purge on boot, then hourly.
  const purgeInspection = () =>
    repo
      .purgeInspection(new Date(Date.now() - INSPECT_RETENTION_DAYS * 86_400_000).toISOString())
      .then((r) => {
        if (r.rounds || r.blobs) app.log.info(`inspector purge: ${r.rounds} rounds, ${r.blobs} blobs`);
      })
      .catch((err) => app.log.warn({ err }, "inspector purge failed"));
  const purgeTimer = setInterval(purgeInspection, 3_600_000);
  purgeTimer.unref();
  app.addHook("onClose", async () => clearInterval(purgeTimer));

  // Workspace API key for TwoRoute/Dispatch calls — from the forwarded
  // x-api-key when present (gateway forwards it) or the per-login token.
  const apiKeyFor = (req: FastifyRequest): string => {
    const fwd = (req.headers["x-api-key"] as string | undefined) ?? (req.headers["authorization"] as string | undefined)?.replace(/^Bearer\s+/i, "");
    if (fwd) return fwd;
    // Browsers can't set headers on WS upgrades / iframes: the webapp passes
    // the per-login gateway token as ?access_token=.
    const q = new URL(req.url, "http://internal").searchParams.get("access_token");
    return q ?? "";
  };

  const depsFor = (req: FastifyRequest): RunDeps & { tworoute: TworouteClient; dispatch: DispatchClient } => {
    const key = apiKeyFor(req);
    return {
      repo,
      hub,
      tworoute: new TworouteClient(config, key),
      dispatch: new DispatchClient(config, key),
      serviceFetch: opts.twodb?.serviceFetch,
      ...(opts.twodb?.serviceFetch ? { toolkit: createToolkitClient(opts.twodb.serviceFetch) } : {}),
    };
  };

  // Server-side session runtime: message queue + live run/ask state. HTTP
  // runs use the requester's forwarded key; queued drains after the last
  // viewer disconnected fall back to service tokens (one per audience — a
  // token minted for tworoute is rejected by dispatch, and vice versa).
  const runCredentialsFor = (workspaceId: string): RunCredentials => {
    const act = opts.twodb?.actAs;
    return {
      tworoute: act ? act("tworoute", workspaceId) : async () => "",
      dispatch: act ? act("dispatch", workspaceId) : async () => "",
    };
  };
  const sessionRunner = new SessionRunner({
    repo,
    depsFor: (_workspaceId, creds) => {
      return {
        repo,
        hub,
        tworoute: new TworouteClient(config, creds.tworoute),
        dispatch: new DispatchClient(config, creds.dispatch),
        serviceFetch: opts.twodb?.serviceFetch,
        ...(opts.twodb?.serviceFetch ? { toolkit: createToolkitClient(opts.twodb.serviceFetch) } : {}),
      };
    },
    keyFor: runCredentialsFor,
  });

  const requireCtx = (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) {
      void reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    return ctx;
  };

  // Pull-registration manifest.

  // --- sessions --------------------------------------------------------------
  app.post("/sessions", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      spaceId?: string;
      type?: string;
      title?: string;
      runner?: string;
      directory?: string;
      model?: string;
      interactive?: boolean;
      agentId?: string | null;
      message?: string;
    };
    const isChat = body.type === "llm_chat";
    // Resolve the owning directory first (explicit id or auto-register) so its
    // space is the default — API-key callers carry no space context.
    let directoryId = isChat ? null : ((body as { directoryId?: string }).directoryId ?? null);
    if (!directoryId && !isChat) {
      const existing = await repo.getDirectoryByPath(ctx.workspaceId, body.runner!, body.directory!);
      if (existing) directoryId = existing.id;
    }
    const dirRow = directoryId ? await repo.getDirectory(ctx.workspaceId, directoryId) : undefined;
    // Space: explicit → the directory's → the agent's own (first of its spaces) → the caller's.
    const agentRow = body.agentId ? await repo.getAgent(ctx.workspaceId, body.agentId) : undefined;
    const spaceId = body.spaceId ?? dirRow?.space_id ?? agentRow?.space_id ?? ctx.spaceIds[0];
    if (!spaceId) return reply.code(400).send({ error: "no space — pass spaceId, or use a registered directory or an agent that has one" });
    const chatModel = isChat ? (await repo.getOrCreateChatAgent(ctx.workspaceId)).model : null;
    const model = body.model ?? chatModel ?? dirRow?.default_model ?? process.env.ARTISAN_DEFAULT_MODEL ?? "";
    if (!isChat && (!body.runner || !body.directory)) return reply.code(400).send({ error: "runner and directory required" });
    if (!model) return reply.code(400).send({ error: "model required (no default configured)" });

    // Ensure the working directory exists on the runner before anything runs.
    // llm_chat: every chat gets its own microVM (`microvm:chat-<id>`, working dir /app). It is NOT booted here —
    // the first tool call boots it (DispatchClient.ensureMicrovm), so a chat that never uses tools costs nothing.
    const runner = isChat ? `${MICROVM_PREFIX}chat-${newId().slice(-8).toLowerCase()}` : body.runner!;
    const directory = isChat ? "/app" : body.directory!;
    if (!isChat) {
      await depsFor(req)
        .dispatch.exec(runner, `mkdir -p ${shellQuote(directory)} && echo ok`, "/", 15_000)
        .catch((err) => {
          throw new Error(`runner "${runner}" unreachable: ${(err as Error).message}`);
        });
    }

    // Auto-register the path if not already a directory.
    if (!directoryId && !isChat) {
      const created = await repo.createDirectory({
        workspaceId: ctx.workspaceId,
        spaceId,
        runner,
        path: directory,
        defaultModel: model,
      });
      directoryId = created.id;
    }

    const session = await repo.createSession({
      workspaceId: ctx.workspaceId,
      spaceId,
      type: body.type ?? "directory",
      title: body.title ?? `session-${newId().slice(-4)}`,
      runner,
      directory,
      directoryId,
      model,
      interactive: body.interactive ?? true,
      agentId: body.agentId ?? null,
    });
    const agentForRun = await repo.agentForSession(session);

    // Optional opening message — through the session runner so it lands in
    // the same queue/run tracking as every later message.
    if (body.message && agentForRun) {
      void sessionRunner.enqueue(ctx.workspaceId, session.id, body.message);
    }
    return sessionOut(session);
  });

  app.get("/sessions", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const q = req.query as { type?: string; runner?: string; directory?: string; spaceId?: string; all?: string; archived?: string; agentId?: string };
    const filter: { type?: string; runner?: string; directory?: string; spaceId?: string; agentId?: string; archived?: "include" | "only" } = {};
    if (q.agentId) filter.agentId = q.agentId;
    if (q.archived === "include") filter.archived = "include";
    if (q.all !== "1" && !q.agentId) filter.type = q.type ?? "directory";
    else if (q.type) filter.type = q.type;
    if (q.runner) filter.runner = q.runner;
    if (q.directory) filter.directory = q.directory;
    if (q.spaceId) filter.spaceId = q.spaceId;
    const rows = await repo.listSessions(ctx.workspaceId, filter);
    return rows.map(sessionOut);
  });

  app.get("/sessions/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const messages = await repo.listSessionMessages(id);
    const usageRow = await repo.getUsage(id);
    // Context fill = prompt size of the most recent request, not the lifetime sum.
    let contextTokens = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "assistant") continue;
      const u = (JSON.parse(messages[i].meta_json || "{}") as { usage?: { prompt_tokens?: number } | null }).usage;
      if (u?.prompt_tokens) {
        contextTokens = u.prompt_tokens;
        break;
      }
    }
    const usage = usageRow
      ? {
          inputTokens: usageRow.input_tokens,
          outputTokens: usageRow.output_tokens,
          cachedTokens: usageRow.cached_tokens,
          contextTokens,
          calls: usageRow.calls,
          costUsd: usageRow.cost_usd,
        }
      : null;
    const plan = session.plan_json ? JSON.parse(session.plan_json) : null;
    const live = sessionRunner.snapshot(id);
    const prs = await repo.listSessionPrs(ctx.workspaceId, id);
    return { ...sessionOut(session), plan, running: live.running, queue: live.queue, ask: live.ask, prs: prs.map((r) => ({ id: r.id, url: r.url })), usage, messages: messages.map(messageOut) };
  });

  // Canvas metadata lives in Artisan; document content is fetched from Paintress.
  app.get("/sessions/:id/canvases", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    if (!opts.twodb?.serviceFetch) return reply.code(503).send({ error: "Paintress integration unavailable" });
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const agent = await repo.agentForSession(session);
    if (!agent) return reply.code(404).send({ error: "agent not found" });
    return listCanvasContent({ repo, serviceFetch: opts.twodb.serviceFetch, session, agent });
  });

  // Inspector: the exact request sent for one round (kept INSPECT_RETENTION_DAYS days).
  app.get("/sessions/:id/inspect/:inspectId", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id, inspectId } = req.params as { id: string; inspectId: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const snap = await repo.getInspectRound(id, inspectId);
    if (!snap) return reply.code(404).send({ error: "expired", retentionDays: INSPECT_RETENTION_DAYS });
    return snap;
  });

  app.patch("/sessions/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as {
      title?: string;
      model?: string;
      thinkingLevel?: string | null;
      archived?: boolean;
      marker?: string | null;
      prUrl?: string | null;
      notes?: string | null;
      plan?: Array<{ description: string; status: string }> | null;
    };
    if (body.title) await repo.renameSession(ctx.workspaceId, id, body.title);
    if (body.archived !== undefined) await repo.setSessionArchived(ctx.workspaceId, id, body.archived);
    if (body.marker !== undefined) {
      const m = body.marker;
      if (m !== null && m !== "ip" && m !== "do" && m !== "at" && m !== "re" && m !== "ho") return reply.code(400).send({ error: "marker must be ip|re|do|at|ho|null" });
      await repo.setSessionMarker(ctx.workspaceId, id, m);
    }
    if (body.prUrl !== undefined) {
      const url = (body.prUrl ?? "").trim();
      if (url && !/^https?:\/\/[\w.-]+\/[^/]+\/[^/]+\/pull\/\d+/.test(url)) return reply.code(400).send({ error: "not a pull request URL" });
      if (url) await repo.addSessionPr(ctx.workspaceId, id, url);
      const rows = await repo.listSessionPrs(ctx.workspaceId, id);
      hub.broadcast(ctx.workspaceId, id, { type: "pr", prs: rows.map((r) => ({ id: r.id, url: r.url })) });
    }
    if (body.notes !== undefined) await repo.setSessionNotes(ctx.workspaceId, id, body.notes ? body.notes.slice(0, 100_000) : null);
    if (body.model) await repo.setSessionModel(ctx.workspaceId, id, body.model);
    if (body.thinkingLevel !== undefined) await repo.setSessionThinkingLevel(ctx.workspaceId, id, body.thinkingLevel);
    if (body.plan !== undefined) await repo.setSessionPlan(id, body.plan);
    const session = await repo.getSession(ctx.workspaceId, id);
    const plan = session?.plan_json ? JSON.parse(session.plan_json) : null;
    return session ? { ...sessionOut(session), plan } : reply.code(404).send({ error: "not found" });
  });

  app.delete("/sessions/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    if (!sessionRunner.isIdle(id)) return reply.code(409).send({ error: "session running" });
    sessionRunner.clearQueue(id);
    const doomed = await repo.getSession(ctx.workspaceId, id);
    const ok = await repo.deleteSession(ctx.workspaceId, id);
    // A deleted chat releases its microVM (best-effort; it may never have booted).
    if (ok && doomed?.type === "llm_chat" && doomed.runner.startsWith(MICROVM_PREFIX))
      void depsFor(req).dispatch.shutdownMicrovm(doomed.runner.slice(MICROVM_PREFIX.length));
    return { ok };
  });

  // Message send — always lands in the server-side queue; the runner
  // dispatches it immediately when the session is idle, or after the current
  // run ends. Clients can disconnect freely; the queue survives them.
  app.post("/sessions/:id/messages", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { message: string };
    if (typeof body.message !== "string" || !body.message.trim()) return reply.code(400).send({ error: "message is required" });
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const { queued } = await sessionRunner.enqueue(ctx.workspaceId, id, body.message);
    return { ok: true, queued };
  });

  // Queued (steering) messages — visible to every viewer, removable while
  // they haven't been dispatched yet.
  app.get("/sessions/:id/queue", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    return { queue: sessionRunner.listQueue(id) };
  });

  app.delete("/sessions/:id/queue/:itemId", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id, itemId } = req.params as { id: string; itemId: string };
    const ok = sessionRunner.removeQueued(id, itemId);
    return { ok };
  });

  // Send the queued messages now: the current run is aborted and the queue
  // dispatches the moment its done frame lands.
  app.post("/sessions/:id/queue/send", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    await sessionRunner.sendNow(ctx.workspaceId, id);
    return { ok: true };
  });

  // /new — close the current thread, open a fresh one.
  app.post("/sessions/:id/new", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    if (!sessionRunner.isIdle(id)) return reply.code(409).send({ error: "session running" });
    const thread = await repo.currentThread(id);
    if (thread) await repo.closeThread(thread.id);
    const fresh = await repo.openThread(id);
    await repo.setSessionPlan(id, null);
    // A marker row in the fresh thread gives every client a visible "new thread"
    // divider in the transcript (skipped by the model context builder).
    await repo.addMessage({
      threadId: fresh.id,
      sessionId: id,
      role: "system",
      content: "New thread started — earlier messages are kept below for reference but are no longer part of the context.",
      meta: { trigger: "new_thread" },
    });
    hub.broadcast(ctx.workspaceId, id, { type: "new_thread" });
    return { ok: true };
  });

  // Compaction — manual /compact.
  app.post("/sessions/:id/compact", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    if (!sessionRunner.isIdle(id)) return reply.code(409).send({ error: "session running" });
    const deps = depsFor(req);
    const msgs = await repo.listSessionMessages(id);
    // serialize into ChatMessages roughly for the summarizer
    const { buildCompactionInput } = await import("./ws/compact-input.js");
    const input = buildCompactionInput(msgs);
    const summary = await runCompaction(deps, session, session.model, input);
    // Persist a transcript marker so the compaction is visible in the thread —
    // previously only a WS frame went out, leaving no trace for other clients
    // or after a reload (the auto-compaction path does the same, see agent-loop).
    const markerThread = await repo.currentThread(id);
    if (markerThread) {
      await repo.addMessage({ threadId: markerThread.id, sessionId: id, role: "compaction", content: summary, meta: { trigger: "manual" } });
    }
    hub.broadcast(ctx.workspaceId, id, { type: "compaction_done", summary });
    return { ok: true, summary };
  });

  // Provider usage quotas — proxied from TwoRoute (same forwarded key the
  // agent loop uses for model calls) so the sidebar can show live quota
  // windows per connection.
  app.get("/quotas", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    try {
      const client = new QuotaClient(config, apiKeyFor(req));
      const model = (req.query as { model?: string }).model;
      const data = await client.quotas();
      // ?model=<session model> → only that provider's connection. The chat
      // sidebar shows the provider the session is actually using, not every
      // connection in the workspace.
      if (model) {
        const connId = QuotaClient.connectionForModel(model, data.connections);
        if (connId) {
          return { connections: data.connections.filter((c) => c.id === connId), quotas: data.quotas.filter((q) => q.connectionId === connId) };
        }
        return { connections: [], quotas: [] };
      }
      return data;
    } catch (err) {
      return reply.code(502).send({ error: (err as Error).message });
    }
  });

  // --- agents ----------------------------------------------------------------
  app.post("/agents", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      spaceId?: string;
      spaceIds?: string[];
      type?: string;
      name?: string;
      description?: string;
      instruction?: string;
      model?: string | null;
      tools?: string[];
      skillTags?: string[];
      tags?: string[];
      runner?: string | null;
      directory?: string | null;
    };
    if (!body.name?.trim() || !body.type) return reply.code(400).send({ error: "name and type required" });
    const agent = await repo.createAgent({
      workspaceId: ctx.workspaceId,
      spaceId: body.spaceIds?.[0] ?? body.spaceId ?? ctx.spaceIds[0],
      spaceIds: body.spaceIds?.length ? body.spaceIds : undefined,
      type: body.type,
      name: body.name,
      description: body.description ?? "",
      instruction: body.instruction ?? "",
      model: body.model ?? null,
      tools: body.tools ?? [],
      skillTags: body.skillTags ?? ["default"],
      tags: body.tags ?? ["default"],
      runner: body.runner ?? null,
      directory: body.directory ?? null,
    });
    void collab?.syncBot(agent).catch((err) => app.log.warn({ err }, "collab bot sync failed"));
    return agentOut(agent);
  });

  app.get("/agents", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const q = req.query as { spaceId?: string };
    const rows = await repo.listAgents(ctx.workspaceId, q.spaceId ?? ctx.spaceIds[0]);
    // The workspace-wide chat agent belongs to no single space, so the space filter above never returns it —
    // append it so it can be targeted by agent pickers (Toolkit access, Skill / MCP availability). It is
    // created on first read, so it is always selectable. (The webapp's Agents tab hides it: it lives in Settings.)
    const chat = await repo.getOrCreateChatAgent(ctx.workspaceId);
    return [...rows.filter((a) => a.id !== chat.id), chat].map(agentOut);
  });

  app.get("/agents/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const agent = await repo.getAgent(ctx.workspaceId, id);
    return agent ? agentOut(agent) : reply.code(404).send({ error: "not found" });
  });

  /** Tool catalogue an agent can be given (name + description). */
  app.get("/tools", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const deps = depsFor(req);
    const all = [
      ...fileTools(deps.dispatch),
      ...subagentTools(),
      ...memoryTools(),
      ...(deps.serviceFetch ? canvasTools(deps.serviceFetch) : []),
      ...(deps.toolkit ? toolkitTools(deps.toolkit) : []),
      askUserTool(),
    ];
    return all.map((t) => ({ name: t.name, description: t.description }));
  });

  app.patch("/agents/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    // Directory agents are fixed to their runner + directory + space.
    const current = await repo.getAgent(ctx.workspaceId, id);
    if (!current) return reply.code(404).send({ error: "not found" });
    const fixed = current.type === "directory";
    // The llm_chat agent is workspace-wide and its runner is always the chat's own microVM: only instruction, model and tools are configurable.
    if (current.type === "llm_chat") {
      const updated = await repo.updateAgent(ctx.workspaceId, id, {
        instruction: body.instruction as string | undefined,
        model: body.model as string | null | undefined,
        tools: body.tools as string[] | undefined,
      });
      return updated ? agentOut(updated) : reply.code(404).send({ error: "not found" });
    }
    const agent = await repo.updateAgent(ctx.workspaceId, id, {
      name: body.name as string | undefined,
      spaceIds: fixed ? undefined : ((body.spaceIds as string[] | undefined) ?? (typeof body.spaceId === "string" ? [body.spaceId] : undefined)),
      description: body.description as string | undefined,
      instruction: body.instruction as string | undefined,
      model: body.model as string | null | undefined,
      tools: body.tools as string[] | undefined,
      skillTags: body.skillTags as string[] | undefined,
      tags: body.tags as string[] | undefined,
      runner: fixed ? undefined : (body.runner as string | null | undefined),
      directory: fixed ? undefined : (body.directory as string | null | undefined),
    });
    if (agent) void collab?.syncBot(agent).catch((err) => app.log.warn({ err }, "collab bot sync failed"));
    return agent ? agentOut(agent) : reply.code(404).send({ error: "not found" });
  });

  app.delete("/agents/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const existing = await repo.getAgent(ctx.workspaceId, id);
    const ok = await repo.deleteAgent(ctx.workspaceId, id);
    if (ok && existing?.type === "collaborator") void collab?.removeBot(ctx.workspaceId, id).catch((err) => app.log.warn({ err }, "collab bot removal failed"));
    return { ok };
  });

  // --- away mode: ask_user auto-answers with the recommended option -----------
  app.get("/settings/away-mode", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const s = await repo.getSetting(ctx.workspaceId, "away_mode");
    return { away: s?.value === "1" };
  });
  app.put("/settings/away-mode", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as { away?: boolean };
    if (typeof body.away !== "boolean") return reply.code(400).send({ error: "away must be boolean" });
    await repo.setSetting(ctx.workspaceId, "away_mode", body.away ? "1" : "0");
    return { away: body.away };
  });

  // --- global instruction: base rules prepended to every agent's prompt ------
  const MAX_GLOBAL_INSTRUCTION = 20_000;
  app.get("/settings/global-instruction", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const s = await repo.getSetting(ctx.workspaceId, "global_instruction");
    return { content: s?.value ?? "", updatedAt: s?.updatedAt ?? null };
  });
  app.put("/settings/global-instruction", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const content = (req.body as { content?: unknown } | null)?.content;
    if (typeof content !== "string") return reply.code(400).send({ error: "content must be a string" });
    if (content.length > MAX_GLOBAL_INSTRUCTION) return reply.code(400).send({ error: `too long (max ${MAX_GLOBAL_INSTRUCTION} characters)` });
    const s = await repo.setSetting(ctx.workspaceId, "global_instruction", content);
    return { content: s.value, updatedAt: s.updatedAt };
  });

  // --- llm_chat agent: the one agent shared by every plain chat -------------
  const chatAgentOut = (a: { id: string; instruction: string; model: string | null }) => ({ id: a.id, instruction: a.instruction, model: a.model });
  app.get("/settings/chat-agent", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    return chatAgentOut(await repo.getOrCreateChatAgent(ctx.workspaceId));
  });
  app.put("/settings/chat-agent", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as { instruction?: unknown; model?: unknown };
    if (body.instruction !== undefined && typeof body.instruction !== "string") return reply.code(400).send({ error: "instruction must be a string" });
    if (typeof body.instruction === "string" && body.instruction.length > MAX_GLOBAL_INSTRUCTION)
      return reply.code(400).send({ error: `too long (max ${MAX_GLOBAL_INSTRUCTION} characters)` });
    if (body.model !== undefined && body.model !== null && typeof body.model !== "string")
      return reply.code(400).send({ error: "model must be a string or null" });
    const agent = await repo.getOrCreateChatAgent(ctx.workspaceId);
    const updated = await repo.updateAgent(ctx.workspaceId, agent.id, {
      instruction: body.instruction as string | undefined,
      model: body.model === "" ? null : (body.model as string | null | undefined),
    });
    return chatAgentOut(updated ?? agent);
  });

  // --- MCP servers (config only — not injected into agents yet) --------------
  const parseMcpScope = (raw: unknown): McpScope | { error: string } => {
    const r = (raw ?? {}) as Partial<McpScope>;
    const scope: McpScope = { mode: (r.mode ?? "global") as McpMode, all: Boolean(r.all), ids: Array.isArray(r.ids) ? r.ids.map(String) : [] };
    const err = validateMcpScope(scope);
    return err ? { error: err } : scope;
  };
  /** Name must be unique in the workspace (case-insensitive) — it becomes the tool prefix mcp__<name>__. */
  const mcpNameTaken = async (workspaceId: string, name: string, exceptId?: string) =>
    (await repo.listMcpServers(workspaceId)).some((r) => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase());

  app.get("/mcp", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    return (await repo.listMcpServers(ctx.workspaceId)).map(mcpOut);
  });

  app.get("/mcp/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const row = await repo.getMcpServer(ctx.workspaceId, (req.params as { id: string }).id);
    return row ? mcpOut(row) : reply.code(404).send({ error: "not found" });
  });

  app.post("/mcp", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!NAME_RE.test(name)) return reply.code(400).send({ error: "name must be letters, digits, _ or - (it prefixes the tool names)" });
    const url = validUrl(b.url);
    if (!url) return reply.code(400).send({ error: "url must be an http(s) URL" });
    const transport = b.transport === undefined ? "auto" : String(b.transport);
    if (!(MCP_TRANSPORTS as readonly string[]).includes(transport)) return reply.code(400).send({ error: "transport must be auto, http or sse" });
    const headers = parseHeaders(b.headers);
    if (headers === "invalid") return reply.code(400).send({ error: "headers must be an object of strings" });
    const scope = parseMcpScope(b.scope);
    if ("error" in scope) return reply.code(400).send({ error: scope.error });
    if (await mcpNameTaken(ctx.workspaceId, name)) return reply.code(409).send({ error: `an MCP server named "${name}" already exists` });
    const row = await repo.createMcpServer({ workspaceId: ctx.workspaceId, name, url, transport, headers: headers ?? {}, enabled: b.enabled !== false, scope });
    return mcpOut(row);
  });

  app.patch("/mcp/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (!(await repo.getMcpServer(ctx.workspaceId, id))) return reply.code(404).send({ error: "not found" });
    const p: Parameters<typeof repo.updateMcpServer>[2] = {};
    if (b.name !== undefined) {
      const name = typeof b.name === "string" ? b.name.trim() : "";
      if (!NAME_RE.test(name)) return reply.code(400).send({ error: "name must be letters, digits, _ or -" });
      if (await mcpNameTaken(ctx.workspaceId, name, id)) return reply.code(409).send({ error: `an MCP server named "${name}" already exists` });
      p.name = name;
    }
    if (b.url !== undefined) {
      const url = validUrl(b.url);
      if (!url) return reply.code(400).send({ error: "url must be an http(s) URL" });
      p.url = url;
    }
    if (b.transport !== undefined) {
      if (!(MCP_TRANSPORTS as readonly string[]).includes(String(b.transport))) return reply.code(400).send({ error: "transport must be auto, http or sse" });
      p.transport = String(b.transport);
    }
    if (b.headers !== undefined) {
      const headers = parseHeaders(b.headers);
      if (headers === "invalid" || !headers) return reply.code(400).send({ error: "headers must be an object of strings" });
      p.headers = headers;
    }
    if (b.enabled !== undefined) p.enabled = Boolean(b.enabled);
    if (b.scope !== undefined) {
      const scope = parseMcpScope(b.scope);
      if ("error" in scope) return reply.code(400).send({ error: scope.error });
      p.scope = scope;
    }
    if (Object.keys(p).length === 0) return reply.code(400).send({ error: "nothing to update" });
    const row = await repo.updateMcpServer(ctx.workspaceId, id, p);
    return row ? mcpOut(row) : reply.code(404).send({ error: "not found" });
  });

  app.delete("/mcp/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    return (await repo.deleteMcpServer(ctx.workspaceId, (req.params as { id: string }).id)) ? { ok: true } : reply.code(404).send({ error: "not found" });
  });

  /** Parses an mcpServers JSON paste without writing — the dialog's preview. */
  app.post("/mcp/import/preview", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const parsed = parseMcpServersJson((req.body as { json?: unknown } | null)?.json);
    return "error" in parsed ? reply.code(400).send(parsed) : parsed;
  });

  /** Bulk create from an mcpServers paste; every server gets the same availability. Name clashes are reported, not overwritten. */
  app.post("/mcp/import", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const b = (req.body ?? {}) as { json?: unknown; scope?: unknown };
    const parsed = parseMcpServersJson(b.json);
    if ("error" in parsed) return reply.code(400).send(parsed);
    const scope = parseMcpScope(b.scope);
    if ("error" in scope) return reply.code(400).send({ error: scope.error });
    const taken = new Set((await repo.listMcpServers(ctx.workspaceId)).map((r) => r.name.toLowerCase()));
    const created: ReturnType<typeof mcpOut>[] = [];
    const conflicts: string[] = [];
    for (const d of parsed.drafts) {
      if (taken.has(d.name.toLowerCase())) {
        conflicts.push(d.name);
        continue;
      }
      taken.add(d.name.toLowerCase());
      created.push(mcpOut(await repo.createMcpServer({ workspaceId: ctx.workspaceId, ...d, enabled: true, scope })));
    }
    return { created, conflicts, skipped: parsed.skipped };
  });

  // --- skills ----------------------------------------------------------------
  const parseScope = (raw: unknown): SkillScope | { error: string } => {
    const r = (raw ?? {}) as Partial<SkillScope>;
    const scope: SkillScope = { mode: (r.mode ?? "global") as SkillMode, all: Boolean(r.all), ids: Array.isArray(r.ids) ? r.ids.map(String) : [] };
    const err = validateScope(scope);
    return err ? { error: err } : scope;
  };

  app.post("/skills", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as { name?: string; description?: string; content?: string; scope?: unknown };
    if (!body.name?.trim()) return reply.code(400).send({ error: "name required" });
    const scope = parseScope(body.scope);
    if ("error" in scope) return reply.code(400).send({ error: scope.error });
    const skill = await repo.createSkill({
      workspaceId: ctx.workspaceId,
      name: body.name.trim(),
      description: body.description ?? "",
      content: body.content ?? "",
      scope,
    });
    return skillOut(skill, true);
  });

  app.get("/skills", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const q = req.query as { content?: string };
    const rows = await repo.listSkills(ctx.workspaceId);
    return rows.map((r) => skillOut(r, q.content === "1"));
  });

  // --- memories --------------------------------------------------------------
  // ?sessionId= → what that session's agent sees; otherwise every memory in the workspace.
  app.get("/memories", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { sessionId } = req.query as { sessionId?: string };
    const rows = sessionId ? await sessionMemories(repo, ctx.workspaceId, sessionId) : await repo.listAllMemories(ctx.workspaceId);
    return rows.map(memoryOut);
  });

  app.post("/memories", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as { level?: string; title?: unknown; content?: unknown; directoryId?: string; agentId?: string; sessionId?: string };
    const level = body.level ?? "organization";
    if (!isLevel(level)) return reply.code(400).send({ error: "level must be organization, code_directory, self or session" });
    const t = normalizeTitle(body.title);
    if (!t.ok) return reply.code(400).send({ error: t.error });
    const c = normalizeContent(body.content);
    if (!c.ok) return reply.code(400).send({ error: c.error });
    const place = { level, directory_id: null as string | null, agent_id: null as string | null, session_id: null as string | null };
    // With a sessionId the owner is derived from that session (sub-agents resolve to their caller).
    const mctx = body.sessionId ? await resolveMemoryContext(repo, ctx.workspaceId, body.sessionId) : null;
    if (mctx) {
      if (level === "code_directory") body.directoryId ??= mctx.directoryId ?? undefined;
      if (level === "self") body.agentId ??= mctx.selfAgentId ?? undefined;
      if (level === "session") body.sessionId = mctx.sessionId;
    }
    if (level === "code_directory") {
      if (!body.directoryId || !(await repo.getDirectory(ctx.workspaceId, body.directoryId)))
        return reply.code(400).send({ error: "this session has no registered directory" });
      place.directory_id = body.directoryId;
    } else if (level === "self") {
      const a = body.agentId ? await repo.getAgent(ctx.workspaceId, body.agentId) : undefined;
      if (!a) return reply.code(400).send({ error: "only persona and collaborator agents have their own memory" });
      if (a.type === "sub_agent" || a.type === "directory")
        return reply.code(400).send({ error: "only persona and collaborator agents have their own memory" });
      place.agent_id = a.id;
    } else if (level === "session") {
      if (!body.sessionId || !(await repo.getSession(ctx.workspaceId, body.sessionId))) return reply.code(400).send({ error: "sessionId required" });
      place.session_id = body.sessionId;
    }
    if (titleTaken(await repo.listAllMemories(ctx.workspaceId), place, t.title))
      return reply.code(409).send({ error: `a memory titled "${t.title}" already exists at that level` });
    const row = await repo.createMemory({
      workspaceId: ctx.workspaceId,
      level,
      title: t.title,
      content: c.content,
      directoryId: place.directory_id,
      agentId: place.agent_id,
      sessionId: place.session_id,
    });
    return memoryOut(row);
  });

  app.patch("/memories/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { title?: unknown; content?: unknown };
    const row = await repo.getMemory(ctx.workspaceId, id);
    if (!row) return reply.code(404).send({ error: "not found" });
    const patchBody: { title?: string; content?: string } = {};
    if (body.title !== undefined) {
      const t = normalizeTitle(body.title);
      if (!t.ok) return reply.code(400).send({ error: t.error });
      if (t.title.toLowerCase() !== row.title.toLowerCase() && titleTaken(await repo.listAllMemories(ctx.workspaceId), row, t.title, row.id)) {
        return reply.code(409).send({ error: `a memory titled "${t.title}" already exists at that level` });
      }
      patchBody.title = t.title;
    }
    if (body.content !== undefined) {
      const c = normalizeContent(body.content);
      if (!c.ok) return reply.code(400).send({ error: c.error });
      patchBody.content = c.content;
    }
    const updated = await repo.updateMemory(ctx.workspaceId, id, patchBody);
    return memoryOut(updated ?? row);
  });

  app.delete("/memories/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    return (await repo.deleteMemory(ctx.workspaceId, id)) ? { ok: true } : reply.code(404).send({ error: "not found" });
  });

  app.get("/skills/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const skill = await repo.getSkill(ctx.workspaceId, id);
    return skill ? skillOut(skill, true) : reply.code(404).send({ error: "not found" });
  });

  app.patch("/skills/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    let scope: SkillScope | undefined;
    if (body.scope !== undefined) {
      const parsed = parseScope(body.scope);
      if ("error" in parsed) return reply.code(400).send({ error: parsed.error });
      scope = parsed;
    }
    const skill = await repo.updateSkill(ctx.workspaceId, id, {
      name: body.name as string | undefined,
      description: body.description as string | undefined,
      content: body.content as string | undefined,
      scope,
    });
    return skill ? skillOut(skill, true) : reply.code(404).send({ error: "not found" });
  });

  app.delete("/skills/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    return { ok: await repo.deleteSkill(ctx.workspaceId, id) };
  });

  // --- directories (registered projects) ---------------------------------------
  function directoryOut(d: {
    id: string;
    space_id: string;
    runner: string;
    path: string;
    title: string;
    default_model: string | null;
    project_settings_json: string;
  }) {
    return {
      id: d.id,
      spaceId: d.space_id,
      runner: d.runner,
      path: d.path,
      title: d.title,
      defaultModel: d.default_model,
      projectSettings: JSON.parse(d.project_settings_json || "{}"),
    };
  }

  app.get("/directories/registered", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    return (await repo.listDirectories(ctx.workspaceId)).map(directoryOut);
  });

  app.post("/directories", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      spaceId?: string;
      runner: string;
      path: string;
      title?: string;
      defaultModel?: string | null;
      projectSettings?: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean };
    };
    if (!body.runner || !body.path) return reply.code(400).send({ error: "runner and path required" });
    const spaceId = body.spaceId ?? ctx.spaceIds[0];
    if (!spaceId) return reply.code(400).send({ error: "no space" });
    const existing = await repo.getDirectoryByPath(ctx.workspaceId, body.runner, body.path);
    if (existing) return reply.code(409).send({ error: "directory already registered", directory: directoryOut(existing) });
    const row = await repo.createDirectory({
      workspaceId: ctx.workspaceId,
      spaceId,
      runner: body.runner,
      path: body.path,
      title: body.title,
      defaultModel: body.defaultModel ?? null,
      projectSettings: body.projectSettings,
    });
    return directoryOut(row);
  });

  app.patch("/directories/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as {
      title?: string;
      defaultModel?: string | null;
      spaceId?: string;
      projectSettings?: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean };
    };
    await repo.updateDirectory(ctx.workspaceId, id, body);
    const row = await repo.getDirectory(ctx.workspaceId, id);
    return row ? directoryOut(row) : reply.code(404).send({ error: "not found" });
  });

  app.delete("/directories/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    return { ok: await repo.deleteDirectory(ctx.workspaceId, id) };
  });

  // --- directories (implicit, from sessions) -----------------------------------
  app.get("/directories", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const registered = await repo.listDirectories(ctx.workspaceId);
    const byPath = new Map(registered.map((d) => [`${d.runner}:${d.path}`, d]));
    const rows = await repo.listSessions(ctx.workspaceId, {});
    const dirs = new Map<
      string,
      {
        runner: string;
        directory: string;
        spaceId: string;
        sessions: number;
        id?: string;
        title?: string;
        defaultModel?: string | null;
        projectSettings?: unknown;
      }
    >();
    for (const s of rows) {
      const key = `${s.runner}:${s.directory}`;
      const existing = dirs.get(key);
      if (existing) existing.sessions += 1;
      else {
        const reg = byPath.get(key);
        dirs.set(key, {
          runner: s.runner,
          directory: s.directory,
          spaceId: s.space_id,
          sessions: 1,
          id: reg?.id,
          title: reg?.title,
          defaultModel: reg?.default_model,
          projectSettings: reg ? JSON.parse(reg.project_settings_json || "{}") : undefined,
        });
      }
    }
    return [...dirs.values()];
  });

  // --- checkpoints (git-ref snapshots on the session directory) -----------------
  app.get("/sessions/:id/checkpoints", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const rows = await repo.listCheckpoints(ctx.workspaceId, id);
    return rows.map(checkpointOut);
  });

  app.post("/sessions/:id/checkpoints", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { label?: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    // Snapshot via a temp GIT_INDEX_FILE — staged state untouched, HEAD stays put.
    const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
    const cpId = newId();
    const script = [
      "git rev-parse --git-dir >/dev/null 2>&1 || exit 14",
      "T=$(mktemp) || exit 10",
      "GIT_INDEX_FILE=$T",
      "export GIT_INDEX_FILE",
      "git read-tree HEAD 2>/dev/null",
      "git add -A",
      "TREE=$(git write-tree 2>/dev/null) || exit 11",
      "rm -f $T",
      "PARENT=$(git rev-parse --verify -q HEAD)",
      'if [ -n "$PARENT" ]; then',
      '  C=$(git commit-tree $TREE -p $PARENT -m "artisan checkpoint")',
      "else",
      '  C=$(git commit-tree $TREE -m "artisan checkpoint")',
      "fi",
      '[ -n "$C" ] || exit 12',
      `git update-ref refs/artisan/checkpoints/${cpId} $C || exit 13`,
      "echo $C",
    ].join("\n");
    const res = await deps.dispatch.exec(session.runner, script, session.directory, 30_000);
    if (res.error) return reply.code(503).send({ error: "runner_offline" });
    if (res.exitCode === 14) return reply.code(409).send({ error: "not_a_git_repo" });
    if (res.exitCode !== 0) return reply.code(500).send({ error: "checkpoint_failed", detail: res.stderr.slice(0, 300) });
    const sha = (res.stdout.trim().split("\n").pop() ?? "").trim();
    if (!/^[0-9a-f]{40,64}$/.test(sha)) return reply.code(500).send({ error: "checkpoint_failed" });
    const row = await repo.addCheckpoint({
      workspaceId: ctx.workspaceId,
      sessionId: id,
      runner: session.runner,
      directory: session.directory,
      label: body.label?.trim().slice(0, 200) || null,
      ref: `refs/artisan/checkpoints/${cpId}`,
      commitSha: sha,
    });
    return checkpointOut(row);
  });

  app.post("/checkpoints/:id/restore", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const cp = await repo.getCheckpoint(ctx.workspaceId, id);
    if (!cp) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    const script = `git restore --source=${cp.ref} --staged --worktree .`;
    const res = await deps.dispatch.exec(cp.runner, script, cp.directory, 30_000);
    if (res.error) return reply.code(503).send({ error: "runner_offline" });
    if (res.exitCode !== 0) return reply.code(500).send({ error: "restore_failed", detail: res.stderr.slice(0, 300) });
    return { ok: true };
  });

  app.delete("/checkpoints/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const cp = await repo.getCheckpoint(ctx.workspaceId, id);
    if (!cp) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    await deps.dispatch.exec(cp.runner, `git update-ref -d ${cp.ref}`, cp.directory, 15_000).catch(() => {});
    return { ok: await repo.deleteCheckpoint(ctx.workspaceId, id) };
  });

  // --- pull requests linked to the session ------------------------------------------
  app.get("/sessions/:id/prs", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const rows = await repo.listSessionPrs(ctx.workspaceId, id);
    return { prs: rows.map((r) => ({ id: r.id, url: r.url })) };
  });

  app.delete("/sessions/:id/prs/:prId", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id, prId } = req.params as { id: string; prId: string };
    const ok = await repo.removeSessionPr(ctx.workspaceId, id, prId);
    const rows = await repo.listSessionPrs(ctx.workspaceId, id);
    hub.broadcast(ctx.workspaceId, id, { type: "pr", prs: rows.map((r) => ({ id: r.id, url: r.url })) });
    return { ok };
  });

  // Live pull request info (gh on the session runner).
  app.get("/sessions/:id/pr", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const url = (req.query as { url?: string }).url ?? (await repo.listSessionPrs(ctx.workspaceId, id))[0]?.url ?? null;
    if (!url) return { pr: null };
    const m = url.match(/^https?:\/\/([\w.-]+)\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!m) return { pr: null, error: "not a pull request URL" };
    const [, host, owner, repoName, num] = m;
    const deps = depsFor(req);
    const fields = "number,title,url,state,isDraft,mergeStateStatus,reviewDecision,additions,deletions,changedFiles,statusCheckRollup,reviews,comments,autoMergeRequest";
    // gh runs in the session's directory on its runner. reviewThreads is NOT a
    // `gh pr view --json` field — open/resolved comment counts come from a
    // GraphQL follow-up appended after an @@threads marker.
    const gql = "query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved}}}}}";
    const script = [
      `gh pr view ${JSON.stringify(url)} --json ${fields} 2>&1 || { echo "@@gh_failed"; exit 13; }`,
      "echo @@threads",
      `GH_HOST=${JSON.stringify(host)} gh api graphql -F owner=${JSON.stringify(owner)} -F repo=${JSON.stringify(repoName)} -F number=${num} -f query=${JSON.stringify(gql)} 2>/dev/null || true`,
    ].join("\n");
    const res = await deps.dispatch.exec(session.runner, script, session.directory, 30_000);
    if (res.exitCode !== 0) {
      return { pr: null, error: (res.stdout || res.stderr || "gh failed").replace("@@gh_failed", "").trim().slice(0, 300) };
    }
    const sep = res.stdout.indexOf("\n@@threads");
    const viewJson = sep >= 0 ? res.stdout.slice(0, sep) : res.stdout;
    const threadsJson = sep >= 0 ? res.stdout.slice(sep + "\n@@threads".length).trim() : "";
    try {
      const raw = JSON.parse(viewJson) as {
        number: number; title: string; url: string; state: string; isDraft: boolean;
        mergeStateStatus?: string; reviewDecision?: string;
        additions?: number; deletions?: number; changedFiles?: number;
        statusCheckRollup?: Array<{ name?: string; context?: string; status?: string; state?: string; conclusion?: string; __typename?: string }>;
        reviews?: Array<{ state?: string }>;
        comments?: unknown[];
        autoMergeRequest?: unknown;
      };
      // GraphQL follow-up: review thread resolution (not exposed by gh pr view).
      let openThreads = 0;
      let resolvedThreads = 0;
      try {
        const g = JSON.parse(threadsJson) as { data?: { repository?: { pullRequest?: { reviewThreads?: { nodes?: Array<{ isResolved?: boolean }> } } } } };
        const nodes = g.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
        resolvedThreads = nodes.filter((t) => t.isResolved).length;
        openThreads = nodes.length - resolvedThreads;
      } catch {
        /* gh api unavailable (older gh, no graphql scope) — counts stay 0 */
      }
      const checks = (raw.statusCheckRollup ?? []).map((c) => ({
        name: c.name ?? c.context ?? "check",
        status: (c.status ?? "").toUpperCase(),
        conclusion: (c.conclusion ?? c.state ?? "").toUpperCase(),
      }));
      const openComments = openThreads + (raw.comments?.length ?? 0);
      const resolvedComments = resolvedThreads;
      return {
        pr: {
          number: raw.number, title: raw.title, url: raw.url, state: raw.state, draft: raw.isDraft,
          mergeState: raw.mergeStateStatus ?? "UNKNOWN",
          reviewDecision: raw.reviewDecision ?? "NONE",
          autoMerge: Boolean(raw.autoMergeRequest),
          additions: raw.additions ?? 0, deletions: raw.deletions ?? 0, changedFiles: raw.changedFiles ?? 0,
          checks, openComments, resolvedComments,
        },
      };
    } catch {
      return { pr: null, error: "could not parse gh output" };
    }
  });

  // --- git status (session directory) -------------------------------------------
  app.get("/sessions/:id/git", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    // Branch, ahead/behind vs upstream, then per-file line counts (numstat vs HEAD) + porcelain status.
    const script = [
      "git rev-parse --abbrev-ref HEAD 2>/dev/null || exit 14",
      'echo "@@ab $(git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null || echo none)"',
      'echo "@@numstat"',
      "git -c core.quotepath=false diff HEAD --numstat 2>/dev/null",
      'echo "@@status"',
      "git -c core.quotepath=false status --porcelain 2>/dev/null",
    ].join("\n");
    const res = await deps.dispatch.exec(session.runner, script, session.directory, 20_000);
    if (res.exitCode === 14) return { git: false };
    if (res.exitCode !== 0) return { git: false, error: res.stderr.slice(0, 200) };
    const lines = res.stdout.split("\n");
    const branch = lines[0]?.trim() ?? "";
    const abLine = lines.find((l) => l.startsWith("@@ab ")) ?? "@@ab none";
    const [behindS, aheadS] = abLine.slice(5).trim().split(/\s+/);
    const hasUpstream = abLine.slice(5).trim() !== "none";
    const iNum = lines.indexOf("@@numstat");
    const iStat = lines.indexOf("@@status");
    const counts = new Map<string, { additions: number | null; deletions: number | null }>();
    for (const l of lines.slice(iNum + 1, iStat)) {
      const [add, del, ...rest] = l.split("\t");
      if (!rest.length) continue;
      counts.set(rest.join("\t"), { additions: add === "-" ? null : Number(add), deletions: del === "-" ? null : Number(del) });
    }
    const files = lines
      .slice(iStat + 1)
      .filter(Boolean)
      .slice(0, 200)
      .map((line) => {
        const status = line.slice(0, 2).trim();
        const path = line
          .slice(3)
          .trim()
          .replace(/^.* -> /, "");
        const c = counts.get(path);
        return { path, status, additions: c?.additions ?? null, deletions: c?.deletions ?? null };
      });
    return {
      git: true,
      branch,
      ahead: hasUpstream ? Number(aheadS) || 0 : null,
      behind: hasUpstream ? Number(behindS) || 0 : null,
      additions: files.reduce((n, f) => n + (f.additions ?? 0), 0),
      deletions: files.reduce((n, f) => n + (f.deletions ?? 0), 0),
      files,
    };
  });

  // --- per-file git diff (Changes view) ------------------------------------------
  app.get("/sessions/:id/diff", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const q = req.query as { path?: string };
    if (!q.path) return reply.code(400).send({ error: "path required" });
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    const safe = q.path.replace(/'/g, "'\\''");
    const script = [
      "git rev-parse --git-dir >/dev/null 2>&1 || exit 14",
      `if git ls-files --error-unmatch '${safe}' >/dev/null 2>&1; then`,
      `  git -c core.quotepath=false diff HEAD -- '${safe}'`,
      "else",
      `  git diff --no-index -- /dev/null '${safe}' || true`,
      "fi",
    ].join("\n");
    const res = await deps.dispatch.exec(session.runner, script, session.directory, 20_000);
    if (res.exitCode === 14) return reply.code(409).send({ error: "not_a_git_repo" });
    if (res.exitCode !== 0) return reply.code(500).send({ error: "git_failed", detail: res.stderr.slice(0, 300) });
    return { path: q.path, diff: res.stdout };
  });

  // --- git commit (sidebar) -------------------------------------------------------
  app.post("/sessions/:id/git/commit", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { message?: string };
    const message = body.message?.trim();
    if (!message) return reply.code(400).send({ error: "message required" });
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    const safe = message.replace(/'/g, "'\\''");
    const script = [
      "git rev-parse --git-dir >/dev/null 2>&1 || exit 14",
      "git add -A",
      "git diff --cached --quiet && exit 15",
      `git -c user.name=artisan -c user.email=artisan@twodb.local commit -q -m '${safe}' || exit 16`,
      "git rev-parse HEAD",
    ].join("\n");
    const res = await deps.dispatch.exec(session.runner, script, session.directory, 30_000);
    if (res.exitCode === 14) return reply.code(409).send({ error: "not_a_git_repo" });
    if (res.exitCode === 15) return reply.code(409).send({ error: "nothing_to_commit" });
    if (res.exitCode !== 0) return reply.code(500).send({ error: "commit_failed", detail: res.stderr.slice(0, 300) });
    return { ok: true, sha: res.stdout.trim() };
  });

  // --- background jobs (sidebar) ----------------------------------------------------
  app.get("/sessions/:id/jobs", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    // Scope to this session: job_start stamps the session id as the dispatch resourceId.
    const jobs = await deps.dispatch.listJobs(session.runner, id);
    return jobs.map((j) => ({
      id: j.id,
      command: j.command,
      status: j.status,
      exitCode: j.exitCode,
      startedAt: j.startedAt,
      endedAt: j.endedAt,
    }));
  });

  // --- child sessions (subagents sidebar) -----------------------------------------
  app.get("/sessions/:id/children", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const rows = await repo.listSessionsAll(ctx.workspaceId, id);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      running: isSessionRunning(r.id),
      adhoc: r.adhoc_prompt !== null,
      updatedAt: r.updated_at,
    }));
  });

  // --- files (editor tab) -------------------------------------------------------
  app.get("/sessions/:id/files", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    const res = await deps.dispatch.exec(
      session.runner,
      "find . -maxdepth 3 -not -path '*/node_modules*' -not -path '*/.git/*' | head -300",
      session.directory,
      15_000,
    );
    const files = res.stdout
      .split("\n")
      .filter((l) => l.startsWith("./"))
      .map((l) => l.slice(2))
      .sort();
    return { files };
  });

  /** Read any absolute path on the runner (e.g. an uploaded attachment under
   *  the shared scratch dir) — same dispatch exec path, bypasses the find-based
   *  listing which only covers the session directory tree. */
  app.get("/files/read", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const q = req.query as { path?: string };
    if (!q.path || q.path.includes("..")) return reply.code(400).send({ error: "invalid path" });
    const deps = depsFor(req);
    // Resolve an online runner to exec against (uploads land on the shared scratch).
    const runners = await deps.dispatch.listRunners();
    const online = runners.find((r) => r.status === "online");
    if (!online) return reply.code(503).send({ error: "no online runner" });
    const safe = q.path.replace(/'/g, "'\\''");
    const res = await deps.dispatch.exec(online.name, `cat '${safe}'`, "/", 15_000);
    if (res.exitCode !== 0) return reply.code(404).send({ error: res.stderr.slice(0, 200) });
    return { path: q.path, content: res.stdout };
  });

  app.get("/sessions/:id/files/*", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id, "*": rawPath } = req.params as { id: string; "*": string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    const safe = rawPath.replace(/'/g, "'\\''");
    const res = await deps.dispatch.exec(session.runner, `cat '${safe}'`, session.directory, 15_000);
    if (res.exitCode !== 0) return reply.code(404).send({ error: res.stderr.slice(0, 200) });
    return { path: rawPath, content: res.stdout };
  });

  app.put("/sessions/:id/files/*", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id, "*": rawPath } = req.params as { id: string; "*": string };
    const body = (req.body ?? {}) as { content?: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    const safe = rawPath.replace(/'/g, "'\\''");
    const script = `mkdir -p $(dirname '${safe}') && cat > '${safe}' <<'__ARTISAN_EOF__'
${body.content ?? ""}
__ARTISAN_EOF__
echo saved`;
    const res = await deps.dispatch.exec(session.runner, script, session.directory, 15_000);
    if (res.exitCode !== 0) return reply.code(500).send({ error: res.stderr.slice(0, 200) });
    return { ok: true };
  });

  // --- console (terminal tab): run a command, get output ------------------------
  app.post("/sessions/:id/console", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { command?: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    if (!body.command) return reply.code(400).send({ error: "command required" });
    const deps = depsFor(req);
    const res = await deps.dispatch.exec(session.runner, body.command, session.directory, 120_000);
    return { stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode };
  });

  // --- terminal relay: browser <-> dispatch /runners/:name/term <-> runner PTY --
  // The webapp can't reach dispatch directly (same-origin through the gateway),
  // so artisan bridges: it dials dispatch's WS relay carrying the workspace key
  // and pipes base64 frames both ways.
  app.get("/sessions/:id/term", { websocket: true }, (socket, req) => {
    const url = new URL(req.url, "http://internal");
    void (async () => {
      const ctx = readForwardedContext(req);
      if (!ctx) return socket.close(4401, "unauthorized");
      const { id } = req.params as { id: string };
      const session = await repo.getSession(ctx.workspaceId, id);
      if (!session) return socket.close(4404, "session not found");
      const runner = url.searchParams.get("runner") ?? session.runner;
      const command = url.searchParams.get("command") ?? `tmux new-session -A -s twodb-${session.id.slice(0, 8)} -c ${shellQuote(session.directory)}`;
      const termCallId = newId();
      const upstream = new WebSocket(
        `${config.DISPATCH_URL.replace(/^http/, "ws")}/runners/${encodeURIComponent(runner)}/term?command=${encodeURIComponent(command)}&cwd=${encodeURIComponent(session.directory)}&callId=${termCallId}`,
        { headers: { authorization: `Bearer ${apiKeyFor(req)}`, "x-twodb-workspace-id": ctx.workspaceId } },
      );
      upstream.on("message", (raw: unknown) => {
        if (socket.readyState === socket.OPEN) socket.send(String(raw));
      });
      upstream.on("close", () => {
        if (socket.readyState === socket.OPEN) socket.close();
      });
      upstream.on("error", () => {
        if (socket.readyState === socket.OPEN) socket.close(1011, "upstream error");
      });
      socket.on("message", (raw: unknown) => {
        const str = String(raw);
        // JSON resize control frame -> forward as a termResize to the runner
        if (str.startsWith("{")) {
          try {
            const m = JSON.parse(str) as { type?: string; cols?: number; rows?: number };
            if (m.type === "resize" && upstream.readyState === upstream.OPEN) {
              upstream.send(JSON.stringify({ type: "termResize", callId: termCallId, cols: m.cols, rows: m.rows }));
              return;
            }
          } catch {
            /* fall through */
          }
        }
        if (upstream.readyState === upstream.OPEN) upstream.send(str);
      });
      socket.on("close", () => {
        try {
          upstream.close();
        } catch {
          /* ignore */
        }
      });
    })();
  });

  // --- code editor (code-server on the session's runner, iframed) --------------
  const EDITOR_PORT = 8443;
  // code-server's bin/code-server is a symlink that loops on some installs —
  // resolve the versioned binary under lib/ instead (the same fallback the
  // start script uses).
  const EDITOR_DIR = `${process.env.HOME ?? "/root"}/.local/share/twodb-editor/code-server`;
  const EDITOR_BIN_RESOLVE = `ls ${shellQuote(EDITOR_DIR)}/lib/code-server-*/bin/code-server 2>/dev/null | head -1`;

  async function editorStatus(session: { runner: string; directory: string }): Promise<{ state: string; bytes?: number; total?: number; port?: number }> {
    const deps = depsFor({ headers: {} } as FastifyRequest);
    const which = await deps.dispatch
      .exec(session.runner, `BIN=$(${EDITOR_BIN_RESOLVE}); [ -n "$BIN" ] && [ -x "$BIN" ] && echo yes`, "/", 10_000)
      .catch(() => null);
    const installed = which?.stdout?.trim().includes("yes");
    if (!installed) return { state: "not_installed" };
    // is it already listening?
    // code-server / returns 302 -> /?folder=…; any non-000 response means it is up
    // NOTE: curl -w '%{http_code}' prints 000 on connection refused, so never
    // pair it with `|| echo 000` (yields "000000" — which is not "000" and once
    // made every down server look ready). Print the code alone.
    const listening = await deps.dispatch
      .exec(session.runner, `curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:${EDITOR_PORT}/ 2>/dev/null; echo`, "/", 10_000)
      .catch(() => null);
    const code = listening?.stdout?.trim();
    if (code && code !== "000" && !code.startsWith("5")) return { state: "ready", port: EDITOR_PORT };
    return { state: "idle", port: EDITOR_PORT };
  }

  app.get("/sessions/:id/editor/status", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    return editorStatus(session);
  });

  app.post("/sessions/:id/editor/install", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    // Install code-server standalone into the runner user's home, atomically:
    // build under a tmp dir and only swap it in once complete — an interrupted
    // download/extract must never leave a half-installed tree that the status
    // check then mistakes for "installed".
    const script = [
      "set -e",
      `BASE=${shellQuote(process.env.HOME ?? "/root")}/.local/share/twodb-editor`,
      'mkdir -p "$BASE"',
      'TMP="$BASE/.install-tmp"',
      // mkdir is atomic — only one install runs at a time; a second concurrent
      // click exits 0 immediately instead of wiping the first install's tmp.
      'if ! mkdir "$TMP.lock" 2>/dev/null; then echo "install already running"; exit 0; fi',
      'trap "rm -rf "$TMP.lock"" EXIT',
      'rm -rf "$TMP" "$BASE/code-server.new"',
      'mkdir -p "$TMP"',
      'cd "$TMP"',
      "curl -fsSL https://code-server.dev/install.sh | sh -s -- --method standalone --prefix ./code-server 2>&1 | tail -5",
      'mv "$TMP/code-server" "$BASE/code-server.new"',
      'rm -rf "$BASE/code-server.old"',
      'if [ -d "$BASE/code-server" ]; then mv "$BASE/code-server" "$BASE/code-server.old"; fi',
      'mv "$BASE/code-server.new" "$BASE/code-server"',
      'rm -rf "$TMP" "$BASE/code-server.old"',
      "echo installed",
    ].join("\n");
    void deps.dispatch.exec(session.runner, script, "/", 600_000).catch(() => {});
    return { ok: true, state: "installing" };
  });

  app.post("/sessions/:id/editor/start", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    // Start code-server as a persistent job bound to localhost, no auth (proxied).
    const status = await editorStatus(session);
    if (status.state === "ready") return { ok: true, port: EDITOR_PORT };
    const csBase = `${process.env.HOME ?? "/root"}/.local/share/twodb-editor/code-server`;
    const script = `CSBIN=$(ls ${shellQuote(csBase)}/lib/code-server-*/bin/code-server 2>/dev/null | head -1); export PASSWORD=; "$CSBIN" --bind-addr 127.0.0.1:${EDITOR_PORT} --auth none --user-data-dir ${shellQuote(session.directory + "/.code-server")} ${shellQuote(session.directory)} > /tmp/code-server.log 2>&1`;
    const job = await deps.dispatch.createJob(session.runner, script, session.directory, session.id).catch((e) => ({ id: "", error: String(e) }));
    if ((job as { error?: string }).error) return reply.code(502).send({ error: (job as { error: string }).error });
    // wait for the port to come up
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const st = await editorStatus(session);
      if (st.state === "ready") return { ok: true, port: EDITOR_PORT };
    }
    return reply.code(502).send({ error: "code-server did not start" });
  });

  // HTTP proxy: /sessions/:id/editor/<path…> -> code-server, rewriting WS URLs.
  // WS upgrade on the editor path (code-server Management/ExtensionHost sockets
  // are built from window.location, so they hit /editor/<stable>…?query) -> proxy
  // to dispatch's proxy-ws tunnel on code-server.
  // Dedicated WS-only path (no HTTP route registered here, so no duplicate-route
  // conflict). The HTML rewrite below points the workbench's same-origin socket
  // URLs at this base; code-server appends <stable-…>?query, which we forward to
  // dispatch's proxy-ws on the code-server port.
  app.get("/sessions/:id/editor-ws/*", { websocket: true }, (socket, req) => {
    void (async () => {
      const ctx = readForwardedContext(req);
      if (!ctx) return socket.close(4401, "unauthorized");
      const { id } = req.params as { id: string };
      const session = await repo.getSession(ctx.workspaceId, id);
      if (!session) return socket.close(4404, "session not found");
      const url = new URL(req.url, "http://internal");
      const sub = url.pathname.split("/editor-ws/")[1] ?? "/";
      // Strip the artisan-auth access_token from the path forwarded to
      // code-server — it's our credential, not code-server's, and a stray
      // unknown query param can break its reconnection handshake.
      url.searchParams.delete("access_token");
      const upstream = new WebSocket(
        `${config.DISPATCH_URL.replace(/^http/, "ws")}/runners/${encodeURIComponent(session.runner)}/proxy-ws?port=${EDITOR_PORT}&path=${encodeURIComponent("/" + sub + url.search)}`,
        { headers: { authorization: `Bearer ${apiKeyFor(req)}`, "x-twodb-workspace-id": ctx.workspaceId } },
      );
      // Binary-safe relay. VS Code's Management/ExtensionHost protocol sends
      // BINARY frames when skipWebSocketFrames=false; dispatch's proxy-ws and the
      // runner carry payloads base64-encoded as text. So: client→upstream we
      // base64-encode the frame (Buffer or string); upstream→client we base64-
      // DECODE back to raw bytes and forward as binary. String(raw) on a Buffer
      // would mangle the frame and stall VS Code's handshake.
      // NB: ws v8 delivers EVERY message (text frames too) as a Buffer, so never
      // sniff typeof === "string". Upstream (dispatch) frames are always base64
      // TEXT → always decode; browser frames are raw bytes → always encode.
      const toB64 = (raw: unknown): string => (typeof raw === "string" ? Buffer.from(raw).toString("base64") : Buffer.from(raw as Buffer).toString("base64"));
      const fromB64 = (raw: unknown): Buffer => Buffer.from(typeof raw === "string" ? raw : (raw as Buffer).toString("latin1"), "base64");
      upstream.on("message", (raw: unknown) => {
        if (socket.readyState === socket.OPEN) socket.send(fromB64(raw));
      });
      upstream.on("close", () => {
        if (socket.readyState === socket.OPEN) socket.close();
      });
      upstream.on("error", () => {
        if (socket.readyState === socket.OPEN) socket.close(1011, "upstream");
      });
      socket.on("message", (raw: unknown) => {
        if (upstream.readyState === upstream.OPEN) upstream.send(toB64(raw));
      });
      socket.on("close", () => {
        try {
          upstream.close();
        } catch {
          /* ignore */
        }
      });
      // Keep the hop chain (browser→gateway→artisan→dispatch→runner→code-server)
      // alive: none of the intermediaries sends WS pings, so a backgrounded tab
      // (browser throttles timers) can let an intermediary reap the connection as
      // idle, surfacing in the workbench as a 1006. Ping both ends; the 'pong'
      // frames keep every hop's read deadline fresh.
      const keepalive = setInterval(() => {
        try {
          if (socket.readyState === socket.OPEN) (socket as unknown as { ping?: () => void }).ping?.();
        } catch {
          /* ignore */
        }
        try {
          if (upstream.readyState === upstream.OPEN) (upstream as unknown as { ping?: () => void }).ping?.();
        } catch {
          /* ignore */
        }
      }, 25_000);
      const stop = () => clearInterval(keepalive);
      socket.on("close", stop);
      upstream.on("close", stop);
    })();
  });

  app.all("/sessions/:id/editor/*", async (req, reply) => {
    // Iframes can't set headers: accept ?access_token= and promote it so the
    // request authenticates exactly like a Bearer call.
    const at = new URL(req.url, "http://internal").searchParams.get("access_token");
    if (at && !req.headers.authorization) req.headers.authorization = `Bearer ${at}`;
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id, "*": rest } = req.params as { id: string; "*": string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    const status = await editorStatus(session);
    if (status.state !== "ready") return reply.code(502).send("editor not running");
    const prefix = `/api/sessions/${id}/editor`;
    const path = "/" + (rest ?? "");
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP_BY_HOP.has(k.toLowerCase())) headers[k] = typeof v === "string" ? v : String(v ?? "");
    delete headers["host"];
    delete headers["content-length"];
    delete headers["connection"];
    // force identity so code-server returns plain text — the base64 WS relay corrupts gzip bytes
    headers["accept-encoding"] = "identity";
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const rawBody: unknown = hasBody ? await (req as { body?: unknown }).body : undefined;
    const bodyBuf = hasBody ? Buffer.from((rawBody as Buffer | undefined) ?? Buffer.alloc(0)) : undefined;
    // follow redirects (code-server / -> /?folder=...) so the iframe gets HTML, not a redirect body
    let proxyPath = path + (req.url.includes("?") ? "?" + req.url.split("?")[1] : "");
    let proxied: { status: number; headers: Record<string, string>; body: string } | { error: string } | undefined;
    for (let redirect = 0; redirect < 4; redirect++) {
      const attempt = await deps.dispatch
        .proxyHttp(session.runner, {
          port: EDITOR_PORT,
          method: req.method,
          path: proxyPath,
          headers,
          bodyBase64: bodyBuf?.toString("base64") ?? "",
        })
        .catch((e) => ({ error: String(e) }));
      if ((attempt as { error?: string }).error) {
        proxied = attempt as { error: string };
        break;
      }
      const pr = attempt as { status: number; headers: Record<string, string>; body: string };
      const loc = pr.headers["location"] ?? pr.headers["Location"];
      if (pr.status >= 300 && pr.status < 400 && loc) {
        proxyPath = loc.startsWith("http") ? new URL(loc).pathname + new URL(loc).search : loc;
        continue;
      }
      proxied = pr;
      break;
    }
    proxied = proxied ?? { error: "too many redirects" };
    if ((proxied as { error?: string }).error) return reply.code(502).send((proxied as { error: string }).error);
    const pr = proxied as { status: number; headers: Record<string, string>; body: string };
    // code-server's standalone tarball omits the dist/browser/* entry point for
    // ~19 built-in extensions (emmet, css/html/json/ts language features, git…),
    // so it 404s them and the web console fills with noise. Serve a minimal AMD
    // stub that activates to nothing — VS Code treats the extension as present
    // but inert, exactly its own fallback for a missing entry point.
    if (pr.status === 404 && /\/extensions\/[^/]+\/.*\/browser\/[^/]+\.js$/.test(path)) {
      reply.type("application/javascript");
      reply.header("cache-control", "no-store");
      return reply.code(200).send("define([], function () { return { activate: function () {} }; });\n");
    }
    const outHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(pr.headers)) if (!HOP_BY_HOP.has(k.toLowerCase()) && k !== "set-cookie") outHeaders[k] = v;
    let out = Buffer.from(pr.body, "base64");
    // code-server gzip-compresses; dispatch drops content-encoding, so detect
    // gzip by magic bytes (1f 8b). Decompress FIRST (before any UTF-8 rewrite,
    // which would corrupt the binary).
    const isGzip = out.length > 2 && out[0] === 0x1f && out[1] === 0x8b;
    if ((isGzip || (pr.headers["content-encoding"] ?? "") === "gzip") && out.length > 0) {
      try {
        out = gunzipSync(out);
        delete outHeaders["content-encoding"];
      } catch {
        /* leave as-is */
      }
    }
    delete outHeaders["content-length"];
    const contentType = outHeaders["content-type"] ?? "";
    if (/^(text\/html|text\/css|application\/javascript|text\/javascript)/.test(contentType)) {
      const proto = (req.headers["x-forwarded-proto"] ?? (req.raw.socket as { encrypted?: boolean })?.encrypted) ? "https" : "http";
      const host = req.headers["host"] ?? "localhost";
      // Origin-RELATIVE path — the browser resolves it against its own origin,
      // so the WS goes to whatever host/port served the page (never the internal
      // artisan host that req.headers.host leaks through the proxy chain).
      const wsBasePath = `/api/sessions/${id}/editor-ws`;
      // Rewrite WS URLs and root-relative asset paths so they resolve through the
      // proxy. Replacement FUNCTIONS keep a literal "$" in the source intact. Only
      // rewrite HTML entry points (which reference the tunnel); leave JS/CSS opaque.
      if (contentType.startsWith("text/html")) {
        out = Buffer.from(
          out
            .toString("utf8")
            .replace(/wss?:\/\/[^"'\\\s]+/g, (m) => {
              // Rewrite same-origin code-server WS URLs to the WS tunnel, preserving the
              // <stable-…>?query suffix. Leave external URLs (voice, telemetry) intact.
              try {
                const u = new URL(m);
                if (u.host !== host) return m; // external
                const edIdx = u.pathname.indexOf("/editor/");
                const suffix = edIdx >= 0 ? u.pathname.slice(edIdx + "/editor/".length) : u.pathname.replace(/^\/+/, "");
                const wsProto = u.protocol === "wss:" ? "wss" : "ws";
                return `${wsProto}://${u.host}${wsBasePath}/${suffix}${u.search}`;
              } catch {
                /* not a full URL — leave */
              }
              return m;
            })
            .replace(/(["'(])(\/?)(stable-[a-z0-9]+|static|webview|vscode-resource|update|manifest\.json)/g, (_m, p1, slash, p2) => `${p1}${prefix}/${p2}`),
          "utf8",
        );

        // Redirect same-origin code-server socket connects (built from
        // window.location, so they point at /editor/<stable>…) to the /editor-ws/
        // tunnel. Done with a WebSocket wrapper because workbench.js derives the
        // URL at runtime — static rewriting can't reach it.
        const wsShim = `<script>(() => { const N = window.WebSocket; const basePath = ${JSON.stringify(wsBasePath)}; const wsProto = location.protocol === "https:" ? "wss" : "ws"; const authTok = new URLSearchParams(location.search).get("access_token") || ""; window.WebSocket = function (url, proto) { try { const u = new URL(url, location.href); if (u.host === location.host) { const i = u.pathname.indexOf("/editor/"); if (i >= 0) { const suffix = u.pathname.slice(i + 8); let q = u.search || ""; if (authTok && !/access_token=/.test(q)) q += (q ? "&" : "?") + "access_token=" + encodeURIComponent(authTok); url = wsProto + "://" + location.host + basePath + "/" + suffix + q; } } } catch (e) {} return proto ? new N(url, proto) : new N(url); }; window.WebSocket.prototype = N.prototype; Object.setPrototypeOf(window.WebSocket, N); })();</script>`;
        const shimIdx = out.toString("utf8").search(/<head[^>]*>/i);
        if (shimIdx >= 0) {
          const headEnd = out.toString("utf8").indexOf(">", shimIdx) + 1;
          out = Buffer.concat([out.subarray(0, headEnd), Buffer.from(wsShim, "utf8"), out.subarray(headEnd)]);
        }
      }
    }
    reply.type(outHeaders["content-type"] ?? "application/octet-stream");
    reply.header("cache-control", "no-store");
    for (const [k, v] of Object.entries(outHeaders)) reply.header(k, v);
    return reply.code(pr.status).send(out);
  });

  // WS tunnel for the code-server workbench: browser <-> dispatch proxy-ws <-> runner.
  app.get("/sessions/:id/editor-ws", { websocket: true }, (socket, req) => {
    const url = new URL(req.url, "http://internal");
    void (async () => {
      const ctx = readForwardedContext(req);
      if (!ctx) return socket.close(4401, "unauthorized");
      const { id } = req.params as { id: string };
      const session = await repo.getSession(ctx.workspaceId, id);
      if (!session) return socket.close(4404, "session not found");
      const port = EDITOR_PORT;
      const path = url.searchParams.get("path") ?? "/";
      const upstream = new WebSocket(
        `${config.DISPATCH_URL.replace(/^http/, "ws")}/runners/${encodeURIComponent(session.runner)}/proxy-ws?port=${port}&path=${encodeURIComponent(path)}`,
        { headers: { authorization: `Bearer ${apiKeyFor(req)}`, "x-twodb-workspace-id": ctx.workspaceId } },
      );
      // Binary-safe relay. VS Code's Management/ExtensionHost protocol sends
      // BINARY frames when skipWebSocketFrames=false; dispatch's proxy-ws and the
      // runner carry payloads base64-encoded as text. So: client→upstream we
      // base64-encode the frame (Buffer or string); upstream→client we base64-
      // DECODE back to raw bytes and forward as binary. String(raw) on a Buffer
      // would mangle the frame and stall VS Code's handshake.
      const toB64 = (raw: unknown): string => (typeof raw === "string" ? raw : Buffer.from(raw as Buffer).toString("base64"));
      const fromB64 = (raw: unknown): Buffer => (typeof raw === "string" ? Buffer.from(raw, "base64") : Buffer.from(raw as Buffer));
      upstream.on("message", (raw: unknown) => {
        if (socket.readyState === socket.OPEN) socket.send(fromB64(raw));
      });
      upstream.on("close", () => {
        if (socket.readyState === socket.OPEN) socket.close();
      });
      upstream.on("error", () => {
        if (socket.readyState === socket.OPEN) socket.close(1011, "upstream");
      });
      socket.on("message", (raw: unknown) => {
        if (upstream.readyState === upstream.OPEN) upstream.send(toB64(raw));
      });
      socket.on("close", () => {
        try {
          upstream.close();
        } catch {
          /* ignore */
        }
      });
    })();
  });

  // --- model + runner proxies ---------------------------------------------------
  app.get("/models", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const deps = depsFor(req);
    return deps.tworoute.listModels();
  });

  app.get("/runners", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const deps = depsFor(req);
    const runners = await deps.dispatch.listRunners();
    return runners.filter((r) => r.status === "online");
  });

  // --- microvms (via dispatch) --------------------------------------------------
  app.get("/microvms", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const vms = await depsFor(req).dispatch.listMicrovms();
    return vms.filter((v) => v.status !== "archived" && v.status !== "failed");
  });

  app.post("/microvms", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as { name?: string; memMb?: number; vcpu?: number };
    const slug = (body.name ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    const identifier = slug || `vm-${newId().slice(-8)}`;
    try {
      const vm = await depsFor(req).dispatch.bootMicrovm({ identifier, memMb: body.memMb, vcpu: body.vcpu });
      return vm;
    } catch (e) {
      return reply.code(502).send({ error: (e as Error).message });
    }
  });

  // --- runner filesystem browser (directory picker) -----------------------------
  app.get("/runners/:runner/fs", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { runner } = req.params as { runner: string };
    const raw = ((req.query as { path?: string }).path ?? "~").trim() || "~";
    const cd = raw === "~" ? `cd "$HOME"` : raw.startsWith("~/") ? `cd "$HOME"/${shellQuote(raw.slice(2))}` : `cd ${shellQuote(raw)}`;
    try {
      const res = await depsFor(req).dispatch.exec(runner, `${cd} && pwd && ls -1Ap`, "/", 15_000);
      if (res.exitCode !== 0) return reply.code(400).send({ error: (res.stderr || res.stdout || "cannot open directory").trim().split("\n").pop() });
      const [cwd, ...lines] = res.stdout.split("\n");
      const entries = lines
        .filter(Boolean)
        .map((l) => (l.endsWith("/") ? { name: l.slice(0, -1), dir: true } : { name: l.replace(/[@*|=]$/, ""), dir: false }));
      return { path: cwd, entries };
    } catch (e) {
      return reply.code(502).send({ error: (e as Error).message });
    }
  });

  app.post("/runners/:runner/fs/mkdir", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { runner } = req.params as { runner: string };
    const body = (req.body ?? {}) as { path?: string };
    if (!body.path || !body.path.startsWith("/")) return reply.code(400).send({ error: "absolute path required" });
    try {
      const res = await depsFor(req).dispatch.exec(runner, `mkdir -p ${shellQuote(body.path)} && echo ok`, "/", 15_000);
      if (res.exitCode !== 0) return reply.code(400).send({ error: (res.stderr || "mkdir failed").trim() });
      return { ok: true, path: body.path };
    } catch (e) {
      return reply.code(502).send({ error: (e as Error).message });
    }
  });

  // --- workspace WS -------------------------------------------------------------
  // Machine-to-machine: the workspace is known per socket, so TwoRoute/Dispatch are called as THIS app via a
  // control-plane service token (actAs, grant `artisan>tworoute,artisan>dispatch`) — no stored API key.
  // Without a control-plane session (tests) there is simply no credential.
  registerWorkspaceWs(app, hub, repo, sessionRunner);

  app.get("/healthz", async () => ({ ok: true }));

  // --- webapp: the bundled SPA (apps/artisan/webapp/dist), served outside /api
  await registerWebapp(app, { distDir: webappDist(import.meta.dirname) });

  void purgeInspection(); // after the tables exist (applySchema ran right after the db was created)

  return app;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function checkpointOut(c: { id: string; session_id: string; label: string | null; commit_sha: string; ref: string; trigger: string; created_at: string }) {
  return { id: c.id, sessionId: c.session_id, label: c.label, commitSha: c.commit_sha, ref: c.ref, trigger: c.trigger, createdAt: c.created_at };
}

function sessionOut(s: {
  id: string;
  type: string;
  title: string;
  runner: string;
  directory: string;
  model: string;
  interactive: boolean;
  space_id: string;
  agent_id: string | null;
  parent_session_id: string | null;
  thinking_level: string | null;
  archived_at?: string | null;
  marker?: string | null;
  pr_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: s.id,
    type: s.type,
    title: s.title,
    runner: s.runner,
    directory: s.directory,
    model: s.model,
    interactive: s.interactive,
    spaceId: s.space_id,
    agentId: s.agent_id,
    parentSessionId: s.parent_session_id,
    thinkingLevel: s.thinking_level,
    archivedAt: s.archived_at ?? null,
    marker: s.marker ?? null,
    prUrl: s.pr_url ?? null,
    notes: s.notes ?? null,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

function messageOut(m: { id: string; role: string; content: string; meta_json: string; created_at: string }) {
  return { id: m.id, role: m.role, content: m.content, meta: JSON.parse(m.meta_json), createdAt: m.created_at };
}

function agentOut(a: {
  id: string;
  type: string;
  name: string;
  description: string;
  instruction?: string;
  model: string | null;
  tools_json: string;
  skill_tags_json: string;
  tags_json: string;
  runner: string | null;
  directory: string | null;
  space_id: string;
  space_ids_json?: string;
}) {
  const ids = a.space_ids_json ? (JSON.parse(a.space_ids_json) as string[]) : [];
  // The llm_chat agent spans every space: it has no space of its own.
  const spaceIds = a.type === "llm_chat" ? [] : ids.length ? ids : [a.space_id];
  return {
    id: a.id,
    type: a.type,
    name: a.name,
    description: a.description,
    instruction: a.instruction ?? "",
    model: a.model,
    tools: JSON.parse(a.tools_json),
    skillTags: JSON.parse(a.skill_tags_json),
    tags: JSON.parse(a.tags_json),
    runner: a.runner,
    directory: a.directory,
    spaceId: spaceIds[0] ?? "",
    spaceIds,
  };
}

function memoryOut(m: MemoryRow) {
  return {
    id: m.id,
    level: m.level,
    title: m.title,
    content: m.content,
    directoryId: m.directory_id,
    agentId: m.agent_id,
    sessionId: m.session_id,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

function mcpOut(r: McpServerRow) {
  let headers: Record<string, string> = {};
  try {
    headers = JSON.parse(r.headers_json) as Record<string, string>;
  } catch {
    /* keep {} */
  }
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    transport: r.transport,
    headers,
    enabled: Number(r.enabled) === 1,
    scope: mcpScopeOf(r),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function skillOut(s: SkillRow, withContent = false) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    scope: scopeOf(s),
    ...(withContent ? { content: s.content } : {}),
  };
}
