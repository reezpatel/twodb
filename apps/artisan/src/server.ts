import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import * as path from "node:path";
import websocket from "@fastify/websocket";
import { WebSocket } from "ws";
import { createPgDb } from "@twodb/core-data/db";

import { applySchema } from "./db/schema.js";
import { createArtisanRepo, newId } from "./db/repository.js";
import { loadArtisanConfig, type ArtisanConfig } from "./config.js";
import { gunzipSync } from "node:zlib";
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
  const HOP_BY_HOP = new Set(["connection","keep-alive","transfer-encoding","te","trailer","upgrade","proxy-authenticate","proxy-authorization","content-length"]);
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

  // --- sessions --------------------------------------------------------------
  app.post("/sessions", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      spaceId?: string; type?: string; title?: string; runner: string; directory: string;
      model?: string; interactive?: boolean; agentId?: string | null; message?: string;
    };
    // Resolve the owning directory first (explicit id or auto-register) so its
    // space is the default — API-key callers carry no space context.
    let directoryId = (body as { directoryId?: string }).directoryId ?? null;
    if (!directoryId) {
      const existing = await repo.getDirectoryByPath(ctx.workspaceId, body.runner, body.directory);
      if (existing) directoryId = existing.id;
    }
    const dirRow = directoryId ? await repo.getDirectory(ctx.workspaceId, directoryId) : undefined;
    const spaceId = body.spaceId ?? dirRow?.space_id ?? ctx.spaceIds[0];
    if (!spaceId) return reply.code(400).send({ error: "no space" });
    const model = body.model ?? dirRow?.default_model ?? process.env.ARTISAN_DEFAULT_MODEL ?? "";
    if (!body.runner || !body.directory) return reply.code(400).send({ error: "runner and directory required" });
    if (!model) return reply.code(400).send({ error: "model required (no default configured)" });

    // Ensure the working directory exists on the runner before anything runs.
    const deps0 = depsFor(req);
    await deps0.dispatch
      .exec(body.runner, `mkdir -p ${shellQuote(body.directory)} && echo ok`, "/", 15_000)
      .catch((err) => {
        throw new Error(`runner "${body.runner}" unreachable: ${(err as Error).message}`);
      });

    // Auto-register the path if not already a directory.
    if (!directoryId) {
      const created = await repo.createDirectory({
        workspaceId: ctx.workspaceId, spaceId, runner: body.runner, path: body.directory,
        defaultModel: model,
      });
      directoryId = created.id;
    }

    const session = await repo.createSession({
      workspaceId: ctx.workspaceId,
      spaceId,
      type: body.type ?? "directory",
      title: body.title ?? `session-${newId().slice(-4)}`,
      runner: body.runner,
      directory: body.directory,
      directoryId,
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
    const usageRow = await repo.getUsage(id);
    const usage = usageRow ? {
      inputTokens: usageRow.input_tokens, outputTokens: usageRow.output_tokens,
      cachedTokens: usageRow.cached_tokens, calls: usageRow.calls, costUsd: usageRow.cost_usd,
    } : null;
    const plan = session.plan_json ? JSON.parse(session.plan_json) : null;
    return { ...sessionOut(session), plan, running: isSessionRunning(id), usage, messages: messages.map(messageOut) };
  });

  app.patch("/sessions/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { title?: string; model?: string; thinkingLevel?: string | null; plan?: Array<{ description: string; status: string }> | null };
    if (body.title) await repo.renameSession(ctx.workspaceId, id, body.title);
    if (body.model) await repo.setSessionModel(ctx.workspaceId, id, body.model);
    if (body.thinkingLevel !== undefined) await repo.setSessionThinkingLevel(ctx.workspaceId, id, body.thinkingLevel);
    if (body.plan !== undefined) await repo.setSessionPlan(id, body.plan);
    const session = await repo.getSession(ctx.workspaceId, id);
    const plan = session?.plan_json ? JSON.parse(session.plan_json) : null;
    return session ? { ...sessionOut(session), plan } : reply.code(404).send({ error: "not found" });
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
    const q = req.query as { spaceId?: string; content?: string };
    const rows = await repo.listSkills(ctx.workspaceId, q.spaceId ?? ctx.spaceIds[0]);
    if (q.content === "1") return rows.map((r) => ({ ...skillOut(r), content: r.content }));
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

  // --- directories (registered projects) ---------------------------------------
  function directoryOut(d: { id: string; space_id: string; runner: string; path: string; title: string; default_model: string | null; project_settings_json: string }) {
    return { id: d.id, spaceId: d.space_id, runner: d.runner, path: d.path, title: d.title, defaultModel: d.default_model, projectSettings: JSON.parse(d.project_settings_json || "{}") };
  }

  app.get("/directories/registered", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    return (await repo.listDirectories(ctx.workspaceId)).map(directoryOut);
  });

  app.post("/directories", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as { spaceId?: string; runner: string; path: string; title?: string; defaultModel?: string | null; projectSettings?: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean } };
    if (!body.runner || !body.path) return reply.code(400).send({ error: "runner and path required" });
    const spaceId = body.spaceId ?? ctx.spaceIds[0];
    if (!spaceId) return reply.code(400).send({ error: "no space" });
    const existing = await repo.getDirectoryByPath(ctx.workspaceId, body.runner, body.path);
    if (existing) return reply.code(409).send({ error: "directory already registered", directory: directoryOut(existing) });
    const row = await repo.createDirectory({
      workspaceId: ctx.workspaceId, spaceId, runner: body.runner, path: body.path,
      title: body.title, defaultModel: body.defaultModel ?? null, projectSettings: body.projectSettings,
    });
    return directoryOut(row);
  });

  app.patch("/directories/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { title?: string; defaultModel?: string | null; spaceId?: string; projectSettings?: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean } };
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
    const dirs = new Map<string, { runner: string; directory: string; spaceId: string; sessions: number; id?: string; title?: string; defaultModel?: string | null; projectSettings?: unknown }>();
    for (const s of rows) {
      const key = `${s.runner}:${s.directory}`;
      const existing = dirs.get(key);
      if (existing) existing.sessions += 1;
      else {
        const reg = byPath.get(key);
        dirs.set(key, { runner: s.runner, directory: s.directory, spaceId: s.space_id, sessions: 1, id: reg?.id, title: reg?.title, defaultModel: reg?.default_model, projectSettings: reg ? JSON.parse(reg.project_settings_json || "{}") : undefined });
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
      workspaceId: ctx.workspaceId, sessionId: id, runner: session.runner, directory: session.directory,
      label: body.label?.trim().slice(0, 200) || null, ref: `refs/artisan/checkpoints/${cpId}`, commitSha: sha,
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

  // --- git status (session directory) -------------------------------------------
  app.get("/sessions/:id/git", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    const script = [
      "git rev-parse --abbrev-ref HEAD 2>/dev/null || exit 14",
      'A=$(git status --porcelain 2>/dev/null | grep -c "^A\|^M\|^ M\|^MM") || A=0',
      'D=$(git status --porcelain 2>/dev/null | grep -c "^D\|^ D") || D=0',
      'echo "$A $D"',
    ].join("\n");
    const res = await deps.dispatch.exec(session.runner, script, session.directory, 20_000);
    if (res.exitCode === 14) return { git: false };
    if (res.exitCode !== 0) return { git: false, error: res.stderr.slice(0, 200) };
    const [branch] = res.stdout.trim().split("\n");
    const last = res.stdout.trim().split("\n").pop() ?? "0 0";
    const [additions, deletions] = last.split(" ");
    const porcelain = await deps.dispatch.exec(session.runner, "git status --porcelain", session.directory, 20_000);
    const files = porcelain.stdout.split("\n").filter(Boolean).slice(0, 50).map((line) => {
      const status = line.slice(0, 2).trim();
      const path = line.slice(3).trim();
      return { path, status };
    });
    return { git: true, branch, additions: Number(additions) || 0, deletions: Number(deletions) || 0, files };
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
      id: j.id, command: j.command, status: j.status, exitCode: j.exitCode,
      startedAt: j.startedAt, endedAt: j.endedAt,
    }));
  });

  // --- child sessions (subagents sidebar) -----------------------------------------
  app.get("/sessions/:id/children", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const rows = await repo.listSessionsAll(ctx.workspaceId, id);
    return rows.map((r) => ({
      id: r.id, title: r.title, running: isSessionRunning(r.id),
      adhoc: r.adhoc_prompt !== null, updatedAt: r.updated_at,
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
      session.directory, 15_000,
    );
    const files = res.stdout.split("\n").filter((l) => l.startsWith("./")).map((l) => l.slice(2)).sort();
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
        { headers: { "x-api-key": apiKeyFor(req) } },
      );
      upstream.on("message", (raw: unknown) => {
        if (socket.readyState === socket.OPEN) socket.send(String(raw));
      });
      upstream.on("close", () => { if (socket.readyState === socket.OPEN) socket.close(); });
      upstream.on("error", () => { if (socket.readyState === socket.OPEN) socket.close(1011, "upstream error"); });
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
          } catch { /* fall through */ }
        }
        if (upstream.readyState === upstream.OPEN) upstream.send(str);
      });
      socket.on("close", () => { try { upstream.close(); } catch { /* ignore */ } });
    })();
  });

  // --- code editor (code-server on the session's runner, iframed) --------------
  const EDITOR_PORT = 8443;
  const EDITOR_BIN = `${process.env.HOME ?? "/root"}/.local/share/twodb-editor/code-server/bin/code-server`;

  async function editorStatus(session: { runner: string; directory: string }): Promise<{ state: string; bytes?: number; total?: number; port?: number }> {
    const deps = depsFor({ headers: {} } as FastifyRequest);
    const which = await deps.dispatch.exec(session.runner, `ls ${shellQuote(EDITOR_BIN)} >/dev/null 2>&1 && echo yes`, "/", 10_000).catch(() => null);
    const installed = which?.stdout?.trim().includes("yes");
    if (!installed) return { state: "not_installed" };
    // is it already listening?
    // code-server / returns 302 -> /?folder=…; any non-000 response means it is up
    const listening = await deps.dispatch.exec(session.runner, `(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${EDITOR_PORT}/ || echo 000) 2>/dev/null`, "/", 10_000).catch(() => null);
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
    // Install code-server standalone tarball (~60MB) into the runner user's home.
    const script = [
      "set -e",
      `mkdir -p ${shellQuote(process.env.HOME ?? "/root")}/.local/share/twodb-editor`,
      `cd ${shellQuote(process.env.HOME ?? "/root")}/.local/share/twodb-editor`,
      "if [ ! -x code-server/bin/code-server ]; then",
      "  curl -fsSL https://code-server.dev/install.sh | sh -s -- --method standalone --prefix ./code-server 2>&1 | tail -5",
      "fi",
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
    const script = `CSBIN=$(ls ${shellQuote(csBase)}/lib/code-server-*/bin/code-server 2>/dev/null | head -1); if [ -z "$CSBIN" ]; then CSBIN=${shellQuote(EDITOR_BIN)}; fi; export PASSWORD=; "$CSBIN" --bind-addr 127.0.0.1:${EDITOR_PORT} --auth none --user-data-dir ${shellQuote(session.directory + "/.code-server")} ${shellQuote(session.directory)} > /tmp/code-server.log 2>&1`;
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
  app.all("/sessions/:id/editor/*", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id, "*": rest } = req.params as { id: string; "*": string };
    const session = await repo.getSession(ctx.workspaceId, id);
    if (!session) return reply.code(404).send({ error: "not found" });
    const deps = depsFor(req);
    const status = await editorStatus(session);
    if (status.state !== "ready") return reply.code(502).send("editor not running");
    const prefix = `/apps/artisan/sessions/${id}/editor`;
    const path = "/" + (rest ?? "");
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP_BY_HOP.has(k.toLowerCase())) headers[k] = typeof v === "string" ? v : String(v ?? "");
    delete headers["host"]; delete headers["content-length"]; delete headers["connection"];
    // force identity so code-server returns plain text — the base64 WS relay corrupts gzip bytes
    headers["accept-encoding"] = "identity";
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const rawBody: unknown = hasBody ? await (req as { body?: unknown }).body : undefined;
    const bodyBuf = hasBody ? Buffer.from((rawBody as Buffer | undefined) ?? Buffer.alloc(0)) : undefined;
    // follow redirects (code-server / -> /?folder=...) so the iframe gets HTML, not a redirect body
    let proxyPath = path + (req.url.includes("?") ? "?" + req.url.split("?")[1] : "");
    let proxied: { status: number; headers: Record<string, string>; body: string } | { error: string } | undefined;
    for (let redirect = 0; redirect < 4; redirect++) {
      const attempt = await deps.dispatch.proxyHttp(session.runner, {
        port: EDITOR_PORT, method: req.method, path: proxyPath,
        headers, bodyBase64: bodyBuf?.toString("base64") ?? "",
      }).catch((e) => ({ error: String(e) }));
      if ((attempt as { error?: string }).error) { proxied = attempt as { error: string }; break; }
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
      } catch { /* leave as-is */ }
    }
    delete outHeaders["content-length"];
    const contentType = outHeaders["content-type"] ?? "";
    if (/^(text\/html|text\/css|application\/javascript|text\/javascript)/.test(contentType)) {
      const proto = req.headers["x-forwarded-proto"] ?? (req.raw.socket as { encrypted?: boolean })?.encrypted ? "https" : "http";
      const host = req.headers["host"] ?? "localhost";
      const wsBase = `${proto === "https" ? "wss" : "ws"}://${host}/apps/artisan/sessions/${id}/editor-ws`;
      // Use replacement FUNCTIONS (not $-template strings) so a "$" in the JS
      // source isn't treated as a regex backreference ($', $&, $1…) and corrupted.
      out = Buffer.from(out.toString("utf8")
        .replace(/wss?:\/\/[^"'\\\s)]+/g, () => wsBase)
        .replace(/(["'(])\/(stable-[a-z0-9]+|static|webview|vscode-resource|update|manifest\.json)/g, (_m, p1, p2) => `${p1}${prefix}/${p2}`), "utf8");
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
        { headers: { "x-api-key": apiKeyFor(req) } },
      );
      upstream.on("message", (raw: unknown) => { if (socket.readyState === socket.OPEN) socket.send(String(raw)); });
      upstream.on("close", () => { if (socket.readyState === socket.OPEN) socket.close(); });
      upstream.on("error", () => { if (socket.readyState === socket.OPEN) socket.close(1011, "upstream"); });
      socket.on("message", (raw: unknown) => { if (upstream.readyState === upstream.OPEN) upstream.send(String(raw)); });
      socket.on("close", () => { try { upstream.close(); } catch { /* ignore */ } });
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

  // --- workspace WS -------------------------------------------------------------
  registerWorkspaceWs(app, hub, repo, { repo, hub, tworoute: new TworouteClient(config, process.env.WORKSPACE_API_KEY ?? ""), dispatch: new DispatchClient(config, process.env.WORKSPACE_API_KEY ?? "") });

  app.get("/healthz", async () => ({ ok: true }));

  // --- webapp: serve the built SPA when its dist exists (release images build
  // it; dev uses the Vite dev server on :6515).
  const webappDist = path.join(import.meta.dirname, "../webapp/dist");
  if (existsSync(path.join(webappDist, "index.html"))) {
    await app.register(fastifyStatic, { root: webappDist, wildcard: false, index: false });
    app.setNotFoundHandler((req, reply) => {
      const pathname = new URL(req.url, "http://internal").pathname;
      const isApi = /^\/(sessions|agents|skills|directories|models|runners|ws|internal|healthz)(\/|$)/.test(pathname);
      if (req.method === "GET" && !isApi) return reply.sendFile("index.html");
      return reply.code(404).send({ error: "not found" });
    });
  }

  await applySchema(db as never);

  return app;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function checkpointOut(c: { id: string; session_id: string; label: string | null; commit_sha: string; ref: string; trigger: string; created_at: string }) {
  return { id: c.id, sessionId: c.session_id, label: c.label, commitSha: c.commit_sha, ref: c.ref, trigger: c.trigger, createdAt: c.created_at };
}

function sessionOut(s: { id: string; type: string; title: string; runner: string; directory: string; model: string; interactive: boolean; space_id: string; agent_id: string | null; parent_session_id: string | null; thinking_level: string | null; created_at: string; updated_at: string }) {
  return {
    id: s.id, type: s.type, title: s.title, runner: s.runner, directory: s.directory,
    model: s.model, interactive: s.interactive, spaceId: s.space_id, agentId: s.agent_id,
    parentSessionId: s.parent_session_id, thinkingLevel: s.thinking_level, createdAt: s.created_at, updatedAt: s.updated_at,
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
