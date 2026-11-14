import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import * as path from "node:path";
import websocket from "@fastify/websocket";
import { createPgDb } from "@twodb/core-data/db";

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
    const body = (req.body ?? {}) as { title?: string; model?: string; thinkingLevel?: string | null };
    if (body.title) await repo.renameSession(ctx.workspaceId, id, body.title);
    if (body.model) await repo.setSessionModel(ctx.workspaceId, id, body.model);
    if (body.thinkingLevel !== undefined) await repo.setSessionThinkingLevel(ctx.workspaceId, id, body.thinkingLevel);
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
    const jobs = await deps.dispatch.listJobs(session.runner);
    // Jobs carry no cwd — show the runner's recent jobs, newest first.
    return jobs.slice(0, 12).map((j) => ({
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
