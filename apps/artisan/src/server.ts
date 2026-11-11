import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { createPgDb } from "@twodb/core-data/db";
import { INTERNAL_MANIFEST_PATH, REGISTRATION_TOKEN_HEADER, handleManifestRequest } from "@twodb/core-platform/manifest";
import { applySchema } from "./db/schema.js";
import { createArtisanRepo, newId } from "./db/repository.js";
import { loadArtisanConfig, type ArtisanConfig } from "./config.js";
import { readForwardedContext } from "./gateway-context.js";
import { artisanManifest } from "./manifest.js";
import { TworouteClient } from "./tworoute-client.js";
import { DispatchClient } from "./dispatch-client.js";
import { WorkspaceHub } from "./ws/hub.js";
import { registerWorkspaceWs } from "./ws/workspace-ws.js";
import { runAgentLoop, isSessionRunning, type RunDeps } from "./ws/agent-loop.js";
import { runCompaction } from "./ws/compaction.js";
import type { FastifyReply, FastifyRequest } from "fastify";

export async function buildServer(config: ArtisanConfig) {
  const app = Fastify({ logger: true });
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  await app.register(websocket);

  const db = createPgDb<{ tables: never }>({ connectionString: config.DATABASE_URL, schema: "artisan" }) as never;
  const repo = createArtisanRepo(db as never);
  const hub = new WorkspaceHub();

  // Workspace API key for TwoRoute/Dispatch calls — from the forwarded
  // x-api-key when present (gateway forwards it) or the provision token env.
  const apiKeyFor = (req: FastifyRequest): string => {
    const fwd = (req.headers["x-api-key"] as string | undefined) ?? (req.headers["authorization"] as string | undefined)?.replace(/^Bearer\s+/i, "");
    return fwd ?? process.env.WORKSPACE_API_KEY ?? "";
  };

  const depsFor = (req: FastifyRequest): RunDeps & { tworoute: TworouteClient; dispatch: DispatchClient } => {
    const key = apiKeyFor(req);
    return {
      repo, hub,
      tworoute: new TworouteClient(config, key),
      dispatch: new DispatchClient(config, key),
    };
  };

  const requireCtx = (req: FastifyRequest, reply: FastifyReply) => {
    const ctx = readForwardedContext(req);
    if (!ctx) {
      void reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    return ctx;
  };

  // Pull-registration manifest.
  app.get(INTERNAL_MANIFEST_PATH, async (req, reply) => {
    const res = handleManifestRequest(
      { ...artisanManifest, version: "0.1.0" },
      { registrationToken: config.TWODB_PROVISION_TOKEN, httpUrl: config.HTTP_URL },
      (req.headers[REGISTRATION_TOKEN_HEADER] as string | undefined) ?? undefined,
    );
    return reply.code(res.status).send(res.body);
  });

  // --- sessions --------------------------------------------------------------
  app.post("/sessions", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      spaceId?: string; type?: string; title?: string; runner: string; directory: string;
      model?: string; interactive?: boolean; agentId?: string | null; message?: string;
    };
    const spaceId = body.spaceId ?? ctx.spaceIds[0];
    if (!spaceId) return reply.code(400).send({ error: "no space" });
    const model = body.model ?? process.env.ARTISAN_DEFAULT_MODEL ?? "";
    if (!body.runner || !body.directory) return reply.code(400).send({ error: "runner and directory required" });
    if (!model) return reply.code(400).send({ error: "model required (no default configured)" });

    // Ensure the working directory exists on the runner before anything runs.
    const deps0 = depsFor(req);
    await deps0.dispatch
      .exec(body.runner, `mkdir -p ${shellQuote(body.directory)} && echo ok`, "/", 15_000)
      .catch((err) => {
        throw new Error(`runner "${body.runner}" unreachable: ${(err as Error).message}`);
      });

    const session = await repo.createSession({
      workspaceId: ctx.workspaceId,
      spaceId,
      type: body.type ?? "directory",
      title: body.title ?? `session-${newId().slice(-4)}`,
      runner: body.runner,
      directory: body.directory,
      model,
      interactive: body.interactive ?? true,
      agentId: body.agentId ?? null,
    });
    await repo.getOrCreateDirectoryAgent(ctx.workspaceId, spaceId, body.runner, body.directory);

    // Optional opening message — run headless through the same loop.
    if (body.message) {
      const deps = depsFor(req);
      const agent = session.agent_id
        ? await repo.getAgent(ctx.workspaceId, session.agent_id)
        : await repo.getOrCreateDirectoryAgent(ctx.workspaceId, spaceId, body.runner, body.directory);
      if (agent) {
        void runAgentLoop({ deps, session, agent, model, apiKey: apiKeyFor(req), userMessage: body.message }).catch(async (err) => {
          console.error("agent loop failed:", err);
          hub.broadcast(ctx.workspaceId, session.id, { type: "error", message: (err as Error).message });
          hub.broadcast(ctx.workspaceId, session.id, { type: "done", ok: false, message: (err as Error).message });
          const t = await repo.currentThread(session.id);
          if (t) await repo.addMessage({ threadId: t.id, sessionId: session.id, role: "assistant", content: `(run failed: ${(err as Error).message})`, meta: { error: true } });
        });
      }
    }
    return sessionOut(session);
  });

  app.get("/sessions", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const q = req.query as { type?: string; runner?: string; directory?: string; spaceId?: string; all?: string };
    const filter: { type?: string; runner?: string; directory?: string; spaceId?: string } = {};
    if (q.all !== "1") filter.type = q.type ?? "directory";
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
    const usage = await repo.getUsage(id);
    const plan = session.plan_json ? JSON.parse(session.plan_json) : null;
    return { ...sessionOut(session), plan, running: isSessionRunning(id), usage, messages: messages.map(messageOut) };
  });

  app.patch("/sessions/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { title?: string; model?: string };
    if (body.title) await repo.renameSession(ctx.workspaceId, id, body.title);
    if (body.model) await repo.setSessionModel(ctx.workspaceId, id, body.model);
    const session = await repo.getSession(ctx.workspaceId, id);
    return session ? sessionOut(session) : reply.code(404).send({ error: "not found" });
  });

  // Message send via HTTP (WS send is the primary path).
  app.post("/sessions/:id/messages", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { message: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    if (isSessionRunning(id)) return reply.code(409).send({ error: "session running" });
    const agent = session.agent_id
      ? await repo.getAgent(ctx.workspaceId, session.agent_id)
      : await repo.getOrCreateDirectoryAgent(ctx.workspaceId, session.space_id, session.runner, session.directory);
    if (!agent) return reply.code(500).send({ error: "agent config missing" });
    void runAgentLoop({ deps: depsFor(req), session, agent, model: session.model, apiKey: apiKeyFor(req), userMessage: body.message }).catch(async (err) => {
      console.error("agent loop failed:", err);
      hub.broadcast(ctx.workspaceId, id, { type: "error", message: (err as Error).message });
      hub.broadcast(ctx.workspaceId, id, { type: "done", ok: false, message: (err as Error).message });
      const t = await repo.currentThread(id);
      if (t) await repo.addMessage({ threadId: t.id, sessionId: id, role: "assistant", content: `(run failed: ${(err as Error).message})`, meta: { error: true } });
    });
    return { ok: true };
  });

  // /new — close the current thread, open a fresh one.
  app.post("/sessions/:id/new", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    if (isSessionRunning(id)) return reply.code(409).send({ error: "session running" });
    const thread = await repo.currentThread(id);
    if (thread) await repo.closeThread(thread.id);
    await repo.openThread(id);
    await repo.setSessionPlan(id, null);
    hub.broadcast(ctx.workspaceId, id, { type: "status", text: "new thread" });
    return { ok: true };
  });

  // Compaction — manual /compact.
  app.post("/sessions/:id/compact", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    if (isSessionRunning(id)) return reply.code(409).send({ error: "session running" });
    const deps = depsFor(req);
    const msgs = await repo.listSessionMessages(id);
    // serialize into ChatMessages roughly for the summarizer
    const { buildCompactionInput } = await import("./ws/compact-input.js");
    const input = buildCompactionInput(msgs);
    const summary = await runCompaction(deps, session, session.model, input);
    hub.broadcast(ctx.workspaceId, id, { type: "compaction_done", summary });
    return { ok: true, summary };
  });

  // --- agents ----------------------------------------------------------------
  app.post("/agents", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      spaceId?: string; type?: string; name?: string; description?: string; instruction?: string;
      model?: string | null; tools?: string[]; skillTags?: string[]; tags?: string[]; runner?: string | null; directory?: string | null;
    };
    if (!body.name || !body.instruction || !body.type) return reply.code(400).send({ error: "name, type, instruction required" });
    const agent = await repo.createAgent({
      workspaceId: ctx.workspaceId,
      spaceId: body.spaceId ?? ctx.spaceIds[0],
      type: body.type,
      name: body.name,
      description: body.description ?? "",
      instruction: body.instruction,
      model: body.model ?? null,
      tools: body.tools ?? [],
      skillTags: body.skillTags ?? ["default"],
      tags: body.tags ?? ["default"],
      runner: body.runner ?? null,
      directory: body.directory ?? null,
    });
    return agentOut(agent);
  });

  app.get("/agents", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const q = req.query as { spaceId?: string };
    const rows = await repo.listAgents(ctx.workspaceId, q.spaceId ?? ctx.spaceIds[0]);
    return rows.map(agentOut);
  });

  app.patch("/agents/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const agent = await repo.updateAgent(ctx.workspaceId, id, {
      name: body.name as string | undefined,
      description: body.description as string | undefined,
      instruction: body.instruction as string | undefined,
      model: body.model as string | null | undefined,
      tools: body.tools as string[] | undefined,
      skillTags: body.skillTags as string[] | undefined,
      tags: body.tags as string[] | undefined,
      runner: body.runner as string | null | undefined,
      directory: body.directory as string | null | undefined,
    });
    return agent ? agentOut(agent) : reply.code(404).send({ error: "not found" });
  });

  app.delete("/agents/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    return { ok: await repo.deleteAgent(ctx.workspaceId, id) };
  });

  // --- skills ----------------------------------------------------------------
  app.post("/skills", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      spaceId?: string; directory?: string | null; name?: string; description?: string; content?: string; tags?: string[];
    };
    if (!body.name || !body.content) return reply.code(400).send({ error: "name and content required" });
    const skill = await repo.createSkill({
      workspaceId: ctx.workspaceId,
      spaceId: body.spaceId ?? ctx.spaceIds[0],
      directory: body.directory ?? null,
      name: body.name,
      description: body.description ?? "",
      content: body.content,
      tags: body.tags ?? ["default"],
    });
    return skillOut(skill);
  });

  app.get("/skills", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const q = req.query as { spaceId?: string };
    const rows = await repo.listSkills(ctx.workspaceId, q.spaceId ?? ctx.spaceIds[0]);
    return rows.map(skillOut);
  });

  app.patch("/skills/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const skill = await repo.updateSkill(ctx.workspaceId, id, {
      name: body.name as string | undefined,
      description: body.description as string | undefined,
      content: body.content as string | undefined,
      directory: body.directory as string | null | undefined,
      tags: body.tags as string[] | undefined,
    });
    return skill ? skillOut(skill) : reply.code(404).send({ error: "not found" });
  });

  app.delete("/skills/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    return { ok: await repo.deleteSkill(ctx.workspaceId, id) };
  });

  // --- directories (implicit, from sessions) -----------------------------------
  app.get("/directories", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const rows = await repo.listSessions(ctx.workspaceId, {});
    const dirs = new Map<string, { runner: string; directory: string; spaceId: string; sessions: number }>();
    for (const s of rows) {
      const key = `${s.runner}:${s.directory}`;
      const existing = dirs.get(key);
      if (existing) existing.sessions += 1;
      else dirs.set(key, { runner: s.runner, directory: s.directory, spaceId: s.space_id, sessions: 1 });
    }
    return [...dirs.values()];
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

  // --- workspace WS -------------------------------------------------------------
  registerWorkspaceWs(app, hub, repo, { repo, hub, tworoute: new TworouteClient(config, process.env.WORKSPACE_API_KEY ?? ""), dispatch: new DispatchClient(config, process.env.WORKSPACE_API_KEY ?? "") });

  await applySchema(db as never);

  return app;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function sessionOut(s: { id: string; type: string; title: string; runner: string; directory: string; model: string; interactive: boolean; space_id: string; agent_id: string | null; parent_session_id: string | null; created_at: string; updated_at: string }) {
  return {
    id: s.id, type: s.type, title: s.title, runner: s.runner, directory: s.directory,
    model: s.model, interactive: s.interactive, spaceId: s.space_id, agentId: s.agent_id,
    parentSessionId: s.parent_session_id, createdAt: s.created_at, updatedAt: s.updated_at,
  };
}

function messageOut(m: { id: string; role: string; content: string; meta_json: string; created_at: string }) {
  return { id: m.id, role: m.role, content: m.content, meta: JSON.parse(m.meta_json), createdAt: m.created_at };
}

function agentOut(a: { id: string; type: string; name: string; description: string; model: string | null; tools_json: string; skill_tags_json: string; tags_json: string; runner: string | null; directory: string | null; space_id: string }) {
  return {
    id: a.id, type: a.type, name: a.name, description: a.description, model: a.model,
    tools: JSON.parse(a.tools_json), skillTags: JSON.parse(a.skill_tags_json), tags: JSON.parse(a.tags_json),
    runner: a.runner, directory: a.directory, spaceId: a.space_id,
  };
}

function skillOut(s: { id: string; name: string; description: string; directory: string | null; tags_json: string; space_id: string }) {
  return {
    id: s.id, name: s.name, description: s.description, directory: s.directory,
    tags: JSON.parse(s.tags_json), spaceId: s.space_id,
  };
}
