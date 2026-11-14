import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import websocket from "@fastify/websocket";
import { createPgDb } from "@twodb/core-data/db";

import { dispatchManifest } from "./manifest.js";
import type { DispatchConfig } from "./config.js";
import { applySchema, type DispatchDb, type JobRow, type MicrovmRow } from "./db/schema.js";
import { createDispatchRepo, generateEnrollmentKey, newId } from "./db/repository.js";
import type { DispatchRepo } from "./db/repository.js";
import { readForwardedContext } from "./gateway-context.js";
import { DispatchHub } from "./ws/hub.js";
import { registerRunnerWs } from "./ws/runner-ws.js";
import { registerArchiveStore, readLatestArchive, archiveExists } from "./ws/archive-store.js";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import * as path from "node:path";

/** In-memory replay buffers per callId — bounded; enough for slow SSE joiners
 *  to see the transcript since the call started. Mirrors the legacy runner
 *  manager's behavior without a DB row per chunk. */
const CALL_BUFFERS = new Map<string, { frame: Record<string, unknown>; at: number }[]>();
const CALL_BUFFER_MAX = 500;

function bufferCall(callId: string, frame: Record<string, unknown>): void {
  let buf = CALL_BUFFERS.get(callId);
  if (!buf) {
    buf = [];
    CALL_BUFFERS.set(callId, buf);
  }
  buf.push({ frame, at: Date.now() });
  if (buf.length > CALL_BUFFER_MAX) buf.splice(0, buf.length - CALL_BUFFER_MAX);
  if (frame.type === "done") {
    // keep the final state around for a short tail window, then drop
    setTimeout(() => CALL_BUFFERS.delete(callId), 60_000).unref();
  }
}

function requireCtx(req: FastifyRequest, reply: FastifyReply): { workspaceId: string } | null {
  const ctx = readForwardedContext(req);
  if (!ctx) {
    void reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return { workspaceId: ctx.workspaceId };
}

async function sseHeaders(reply: FastifyReply): Promise<void> {
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
}

function sseWrite(reply: FastifyReply, event: string, data: unknown): boolean {
  if (reply.raw.writableEnded) return false;
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  return true;
}

export async function buildServer(config: DispatchConfig) {
  const app = Fastify({ logger: true });
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
  await app.register(websocket);

  const db = createPgDb<DispatchDb>({ connectionString: config.DATABASE_URL, schema: "dispatch" });
  await applySchema(db);
  const repo: DispatchRepo = createDispatchRepo(db);
  const hub = new DispatchHub(repo);
  registerArchiveStore(hub, repo);

  // Pull-registration (docker-install flow).

  // --- runner WS (auth = runner key, not session) --------------------------
  registerRunnerWs(app, hub, repo);

  // --- runners ---------------------------------------------------------------
  app.post("/runners", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as { name?: string; kind?: "host" | "microvm-host"; meta?: Record<string, unknown> };
    if (body.name) {
      const existing = await repo.getRunnerByName(ctx.workspaceId, body.name);
      if (existing) return reply.code(409).send({ error: `runner "${body.name}" already exists` });
    }
    const { runner, key } = await repo.createRunner({
      workspaceId: ctx.workspaceId,
      name: body.name,
      kind: body.kind,
      meta: body.meta,
    });
    return {
      runner: { ...runner, meta: JSON.parse(runner.meta_json), key: undefined },
      key,
    };
  });

  app.get("/runners", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const runners = await repo.listRunners(ctx.workspaceId);
    return runners.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      status: r.status,
      meta: JSON.parse(r.meta_json),
      lastSeenAt: r.last_seen_at,
      createdAt: r.created_at,
    }));
  });

  app.delete("/runners/:name", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { name } = req.params as { name: string };
    const row = await repo.getRunnerByName(ctx.workspaceId, name);
    if (!row) return reply.code(404).send({ error: "not found" });
    if (hub.isOnline(row.id)) {
      const online = hub.getOnlineRunner(ctx.workspaceId, name);
      online?.socket.close(4404, "runner deleted");
    }
    const ok = await repo.deleteRunner(ctx.workspaceId, name);
    return { ok };
  });

  function mustRunner(ctx: { workspaceId: string }, name: string, reply: FastifyReply) {
    const online = hub.getOnlineRunner(ctx.workspaceId, name);
    if (!online) {
      void reply.code(404).send({ error: `runner "${name}" is not online` });
      return null;
    }
    return online;
  }

  // --- enrollment tokens -------------------------------------------------------
  // Shared bootstrap credentials: mint a token once, any number of machines
  // can enroll with it (each gets its own runner row + key). The token
  // itself never executes anything.
  app.post("/enroll-tokens", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as { name?: string; expiresInDays?: number };
    const key = generateEnrollmentKey();
    const row = await repo.createEnrollmentToken({
      workspaceId: ctx.workspaceId,
      name: body.name?.trim() || `enroll-${newId().slice(-4)}`,
      key,
      expiresInDays: body.expiresInDays,
    });
    return {
      token: {
        id: row.id,
        name: row.name,
        enrollCount: row.enroll_count,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      },
      key,
    };
  });

  app.get("/enroll-tokens", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const rows = await repo.listEnrollmentTokens(ctx.workspaceId);
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      enrollCount: t.enroll_count,
      lastUsedAt: t.last_used_at,
      expiresAt: t.expires_at,
      createdAt: t.created_at,
    }));
  });

  app.delete("/enroll-tokens/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const ok = await repo.deleteEnrollmentToken(ctx.workspaceId, id);
    return { ok };
  });

  // --- exec (one-shot) -------------------------------------------------------
  app.post("/exec", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      runnerId: string; resourceId?: string; command: string; cwd?: string;
      env?: Record<string, string>; timeoutMs?: number;
    };
    if (!body?.runnerId || !body?.command) return reply.code(400).send({ error: "runnerId and command are required" });
    const runner = mustRunner(ctx, body.runnerId, reply);
    if (!runner) return reply;
    const started = Date.now();
    const result = await hub.sendToRunner(runner, {
      type: "exec",
      callId: newId(),
      command: body.command,
      cwd: body.cwd,
      env: body.env,
      timeoutMs: body.timeoutMs,
    }, { timeoutMs: body.timeoutMs ? body.timeoutMs + 10_000 : 60_000 });
    void repo.appendExecLog({
      workspaceId: ctx.workspaceId, runnerId: runner.runnerId, resourceId: body.resourceId ?? null,
      command: body.command, stream: "stdout", chunk: String((result as any)?.stdout ?? ""),
    }).catch(() => {});
    return {
      exitCode: Number((result as any)?.exitCode ?? -1),
      stdout: String((result as any)?.stdout ?? ""),
      stderr: String((result as any)?.stderr ?? ""),
      durationMs: Date.now() - started,
    };
  });

  // --- call (streamed) -------------------------------------------------------
  app.post("/calls", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      runnerId: string; resourceId?: string; command: string; cwd?: string;
      env?: Record<string, string>; timeoutMs?: number;
    };
    if (!body?.runnerId || !body?.command) return reply.code(400).send({ error: "runnerId and command are required" });
    const runner = mustRunner(ctx, body.runnerId, reply);
    if (!runner) return reply;
    const callId = newId();
    // Collect into the replay buffer while subscribers stream live.
    const unsubBuffer = hub.subscribe(callId, (frame) => bufferCall(callId, frame));
    void unsubBuffer;
    await hub.sendToRunner(runner, {
      type: "call",
      callId,
      command: body.command,
      cwd: body.cwd,
      env: body.env,
      timeoutMs: body.timeoutMs,
    }, { reply: false });
    return { callId, runnerName: runner.name };
  });

  app.get("/calls/:callId/stream", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { callId } = req.params as { callId: string };
    await sseHeaders(reply);
    const replay = CALL_BUFFERS.get(callId) ?? [];
    let done = false;
    for (const { frame } of replay) {
      if (frame.type === "output") sseWrite(reply, "output", { stream: frame.stream, chunk: frame.chunk });
      if (frame.type === "done") done = true;
    }
    if (done || !CALL_BUFFERS.has(callId)) {
      reply.raw.end();
      return reply;
    }
    const unsub = hub.subscribe(callId, (frame) => {
      if (frame.type === "output") {
        sseWrite(reply, "output", { stream: frame.stream, chunk: frame.chunk });
      } else if (frame.type === "done") {
        sseWrite(reply, "done", { exitCode: frame.exitCode });
        reply.raw.end();
      } else if (frame.type === "error") {
        sseWrite(reply, "error", { error: frame.error });
        reply.raw.end();
      }
    });
    req.raw.on("close", () => unsub());
    return reply;
  });

  // --- jobs ------------------------------------------------------------------
  app.post("/jobs", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      runnerId: string; resourceId?: string; command: string; cwd?: string; env?: Record<string, string>;
    };
    if (!body?.runnerId || !body?.command) return reply.code(400).send({ error: "runnerId and command are required" });
    const runner = mustRunner(ctx, body.runnerId, reply);
    if (!runner) return reply;
    const job = await repo.createJob({
      workspaceId: ctx.workspaceId,
      runnerId: runner.runnerId,
      resourceId: body.resourceId ?? null,
      command: body.command,
    });
    void hub.sendToRunner(runner, {
      type: "jobCreate",
      callId: newId(),
      jobId: job.id,
      command: body.command,
      cwd: body.cwd,
      env: body.env,
    }, { reply: false });
    return jobOut(job, new Map([[runner.runnerId, runner.name]]));
  });

  /** Raw job row -> the API shape (camelCase, runner resolved by name). */
  function jobOut(job: JobRow, hubNames: Map<string, string>) {
    return {
      id: job.id,
      runnerId: job.runner_id,
      runnerName: hubNames.get(job.runner_id) ?? null,
      resourceId: job.resource_id,
      command: job.command,
      status: job.status,
      exitCode: job.exit_code,
      startedAt: job.started_at,
      endedAt: job.ended_at,
    };
  }

  app.get("/jobs", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const q = req.query as Record<string, string>;
    const jobs = await repo.listJobs(ctx.workspaceId, {
      runnerId: q.runnerId,
      resourceId: q.resourceId,
      status: q.status,
      limit: q.limit ? Number(q.limit) : undefined,
    });
    const hubNames = new Map(hub.listOnline(ctx.workspaceId).map((r) => [r.runnerId, r.name]));
    return jobs.map((j) => jobOut(j, hubNames));
  });

  app.get("/jobs/:id", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const job = await repo.getJob(ctx.workspaceId, id);
    if (!job) return reply.code(404).send({ error: "not found" });
    const hubNames = new Map(hub.listOnline(ctx.workspaceId).map((r) => [r.runnerId, r.name]));
    return jobOut(job, hubNames);
  });

  app.post("/jobs/:id/terminate", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const job = await repo.getJob(ctx.workspaceId, id);
    if (!job) return reply.code(404).send({ error: "not found" });
    // Find the runner owning this job (online by name, else first online in ws).
    let runner = hub.listOnline(ctx.workspaceId).find((r) => r.runnerId === job.runner_id);
    if (!runner) return reply.code(409).send({ error: "runner is offline" });
    await hub.sendToRunner(runner, { type: "jobSignal", jobId: id, signal: "terminate" }, { reply: false });
    const updated = await repo.getJob(ctx.workspaceId, id);
    return updated ? jobOut(updated, new Map([[runner.runnerId, runner.name]])) : { ok: true };
  });

  /** Feed stdin to a running job (interactive programs: REPLs, prompts,
   *  long-lived watchers). data is raw text; eof=1 closes the job's stdin
   *  so anything reading to EOF finishes. */
  app.post("/jobs/:id/input", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const job = await repo.getJob(ctx.workspaceId, id);
    if (!job) return reply.code(404).send({ error: "not found" });
    if (job.status !== "running") return reply.code(409).send({ error: `job is ${job.status}` });
    const runner = hub.listOnline(ctx.workspaceId).find((r) => r.runnerId === job.runner_id);
    if (!runner) return reply.code(409).send({ error: "runner is offline" });
    const body = (req.body ?? {}) as { data?: string; eof?: boolean };
    if (!body.data && !body.eof) return reply.code(400).send({ error: "data or eof is required" });
    const res = await hub.sendToRunner(runner, {
      type: "jobInput",
      callId: newId(),
      jobId: id,
      data: body.data,
      eof: body.eof ?? false,
    }, { timeoutMs: 10_000 });
    if (!res || res.error) return reply.code(422).send({ error: (res as any)?.error ?? "input failed" });
    return { ok: true };
  });

  app.get("/jobs/:id/tail", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { id } = req.params as { id: string };
    const job = await repo.getJob(ctx.workspaceId, id);
    if (!job) return reply.code(404).send({ error: "not found" });
    const q = req.query as { lines?: string; follow?: string };
    const lines = q.lines ? Number(q.lines) : 1000;

    if (!q.follow || q.follow === "0") {
      const logs = await repo.jobLogs(id, 0);
      return { lines: logs.slice(-lines) };
    }

    // SSE follow: replay what's in the DB, then keep streaming.
    await sseHeaders(reply);
    let afterSeq = 0;
    let finished = false;
    const replay = await repo.jobLogs(id, 0);
    for (const l of replay.slice(-lines)) {
      afterSeq = Math.max(afterSeq, l.seq);
      sseWrite(reply, "log", l);
    }
    if (job.status !== "running") {
      sseWrite(reply, "done", { status: job.status, exitCode: job.exit_code });
      reply.raw.end();
      return reply;
    }
    let liveSeq = afterSeq;
    const unsub = hub.subscribe(`job:${id}`, (frame) => {
      if (frame.type === "jobLog") {
        sseWrite(reply, "log", { seq: frame.seq, stream: frame.stream, line: frame.line });
      } else if (frame.type === "jobStatus") {
        sseWrite(reply, "done", { status: frame.status, exitCode: frame.exitCode });
        finished = true;
        reply.raw.end();
      }
    });
    // Fallback poll while the WS path may have dropped frames: catch DB rows
    // the hub fanout missed (e.g. dispatch restarted mid-job).
    const poll = setInterval(async () => {
      if (finished || reply.raw.writableEnded) return;
      const rows = await repo.jobLogs(id, liveSeq).catch(() => []);
      for (const r of rows) {
        liveSeq = Math.max(liveSeq, r.seq);
        sseWrite(reply, "log", r);
      }
      const fresh = await repo.getJob(ctx.workspaceId, id).catch(() => undefined);
      if (fresh && fresh.status !== "running" && !finished) {
        finished = true;
        sseWrite(reply, "done", { status: fresh.status, exitCode: fresh.exit_code });
        reply.raw.end();
      }
    }, 2_000);
    poll.unref();
    req.raw.on("close", () => {
      clearInterval(poll);
      unsub();
    });
    return reply;
  });

  // --- microvms ---------------------------------------------------------------
  const DEFAULT_IDLE_SEC = Number(process.env.DISPATCH_VM_IDLE_SEC ?? 900);
  const DEFAULT_ARCHIVE_DAYS = Number(process.env.DISPATCH_VM_ARCHIVE_DAYS ?? 7);

  /** Raw microvm row -> the API shape (camelCase). */
  function vmOut(vm: MicrovmRow, hubNames: Map<string, string>) {
    return {
      id: vm.id,
      identifier: vm.identifier,
      runnerId: vm.runner_id,
      runnerName: hubNames.get(vm.runner_id) ?? null,
      status: vm.status,
      cid: vm.cid,
      bootCount: vm.boot_count,
      lastActiveAt: vm.last_active_at,
      createdAt: vm.created_at,
      archivedAt: vm.archived_at,
    };
  }

  app.post("/microvms/boot", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as {
      runnerId?: string; identifier: string; memMb?: number; vcpu?: number; idleShutdownSec?: number;
    };
    if (!body?.identifier) return reply.code(400).send({ error: "identifier is required" });
    // Runner selection: explicit runnerId (name) wins; without one, an
    // existing VM row names its runner (resume on the same host), else the
    // first online microvm-host boots a fresh VM.
    let vm = await repo.getMicrovm(ctx.workspaceId, body.identifier);
    let runnerName = body.runnerId ?? null;
    if (!runnerName && vm) {
      for (const online of hub.listOnline(ctx.workspaceId)) {
        if (online.runnerId === vm.runner_id) {
          runnerName = online.name;
          break;
        }
      }
    }
    if (!runnerName) {
      const fallback = hub.listOnline(ctx.workspaceId).find((r) => true);
      if (fallback) runnerName = fallback.name;
    }
    if (!runnerName) return reply.code(409).send({ error: "no online runner to boot on" });
    const runner = mustRunner(ctx, runnerName, reply);
    if (!runner) return reply;
    // Any previous lifecycle (idle-stopped or archived) means /app lives in
    // the archive store — the runner restores it. Rows get pruned; archives
    // outlive them, so a stored archive also forces resume.
    const hasArchive = await archiveExists(body.identifier);
    const resume =
      hasArchive || Boolean(vm && (vm.status === "idle-stopped" || vm.status === "archived" || vm.status === "failed"));
    if (vm && vm.status === "archived") {
      // Resuming past the archive window: fresh row, archive still restored.
      await repo.deleteMicrovm(ctx.workspaceId, body.identifier);
    }
    const callId = newId();
    const res = await hub.sendToRunner(runner, {
      type: "vmBoot",
      callId,
      identifier: body.identifier,
      cid: vm?.cid ?? null,
      resume,
      memMb: body.memMb,
      vcpu: body.vcpu,
      idleShutdownSec: body.idleShutdownSec ?? DEFAULT_IDLE_SEC,
    }, { timeoutMs: 60_000 });
    if (!res || res.error) return reply.code(422).send({ error: (res as any)?.error ?? "boot failed" });
    if (!vm) {
      vm = await repo.createMicrovm({
        workspaceId: ctx.workspaceId,
        runnerId: runner.runnerId,
        identifier: body.identifier,
        cid: Number((res as any)?.cid ?? 0) || null,
        meta: { memMb: body.memMb, vcpu: body.vcpu, idleShutdownSec: body.idleShutdownSec ?? DEFAULT_IDLE_SEC },
      });
    } else {
      await repo.touchMicrovm(vm.id, {
        status: "running",
        cid: Number((res as any)?.cid ?? 0) || vm.cid,
        last_active_at: new Date().toISOString(),
        archived_at: null,
      });
      vm = await repo.getMicrovm(ctx.workspaceId, body.identifier);
    }
    return vmOut(vm!, new Map([[runner.runnerId, runner.name]]));
  });

  app.post("/microvms/exec", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const body = (req.body ?? {}) as { runnerId: string; identifier: string; command: string; cwd?: string; timeoutMs?: number };
    if (!body?.runnerId || !body?.identifier || !body?.command) {
      return reply.code(400).send({ error: "runnerId, identifier and command are required" });
    }
    const runner = mustRunner(ctx, body.runnerId, reply);
    if (!runner) return reply;
    const started = Date.now();
    const res = await hub.sendToRunner(runner, {
      type: "vmExec",
      callId: newId(),
      identifier: body.identifier,
      command: body.command,
      cwd: body.cwd,
      timeoutMs: body.timeoutMs,
    }, { timeoutMs: (body.timeoutMs ?? 30_000) + 30_000 });
    if (!res || res.error) return reply.code(422).send({ error: (res as any)?.error ?? "vm exec failed" });
    const vm = await repo.getMicrovm(ctx.workspaceId, body.identifier);
    if (vm) await repo.touchMicrovm(vm.id, { last_active_at: new Date().toISOString() });
    return {
      exitCode: Number((res as any)?.exitCode ?? -1),
      stdout: String((res as any)?.stdout ?? ""),
      stderr: String((res as any)?.stderr ?? ""),
      durationMs: Date.now() - started,
    };
  });

  app.get("/microvms", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const vms = await repo.listMicrovms(ctx.workspaceId);
    const hubNames = new Map(hub.listOnline(ctx.workspaceId).map((r) => [r.runnerId, r.name]));
    return vms.map((vm) => vmOut(vm, hubNames));
  });

  app.post("/microvms/:identifier/shutdown", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { identifier } = req.params as { identifier: string };
    const q = req.query as { archive?: string };
    const vm = await repo.getMicrovm(ctx.workspaceId, identifier);
    if (!vm) return reply.code(404).send({ error: "not found" });
    const runner = hub.listOnline(ctx.workspaceId).find((r) => r.runnerId === vm.runner_id);
    if (!runner) return reply.code(409).send({ error: "runner is offline" });
    await hub.sendToRunner(runner, {
      type: "vmShutdown",
      identifier,
      archive: q.archive === "1",
      archiveAfterDays: DEFAULT_ARCHIVE_DAYS,
    }, { reply: false });
    await repo.touchMicrovm(vm.id, {
      status: q.archive === "1" ? "archived" : "idle-stopped",
      archived_at: q.archive === "1" ? new Date().toISOString() : null,
    });
    const patched = await repo.getMicrovm(ctx.workspaceId, identifier);
    return vmOut(patched ?? vm, new Map([[runner.runnerId, runner.name]]));
  });

  // --- terminal / vscode relay (WS bridging caller <-> runner <-> vsock) ----
  app.get("/microvms/:identifier/stream", { websocket: true }, (socket, req) => {
    const url = new URL(req.url, "http://internal");
    const identifier = (req.params as { identifier: string }).identifier;
    const mode = url.searchParams.get("mode") === "vscode" ? "vscode" : "terminal";
    const wsKey = url.searchParams.get("workspace") ?? "";
    void (async () => {
      // Caller must be workspace-authenticated: the Gateway already resolved
      // session/API-key and forwarded x-twodb-workspace-id on the upgrade.
      const wsId = req.headers["x-twodb-workspace-id"] as string | undefined;
      if (!wsId) {
        socket.close(4401, "unauthorized");
        return;
      }
      const vm = await repo.getMicrovm(wsId, identifier).catch(() => undefined);
      if (!vm) {
        socket.close(4404, "microvm not found");
        return;
      }
      const runner = hub.listOnline(wsId).find((r) => r.runnerId === vm.runner_id);
      if (!runner) {
        socket.close(409, "runner offline");
        return;
      }
      const callId = newId();
      // Ask the runner for a vmStream relay; runner replies, then pipes raw
      // bytes as {type:"vmData", callId, data} frames; we send {type:"vmWrite"}.
      const ack = await hub.sendToRunner(runner, {
        type: "vmStream", callId, identifier, mode,
      }, { timeoutMs: 15_000 }).catch(() => null);
      if (!ack || ack.error) {
        socket.close(1011, String((ack as any)?.error ?? "stream failed to start"));
        return;
      }
      const unsub = hub.subscribe(callId, (frame) => {
        if (frame.type === "vmData" && socket.readyState === socket.OPEN) {
          socket.send(frame.data as string);
        } else if (frame.type === "vmClosed") {
          socket.close();
        }
      });
      socket.on("message", (raw: unknown) => {
        if (socket.readyState === socket.OPEN) {
          void hub.sendToRunner(runner, { type: "vmWrite", callId, data: String(raw) }, { reply: false });
        }
      });
      socket.on("close", () => {
        unsub();
        void hub.sendToRunner(runner, { type: "vmClose", callId, identifier }, { reply: false });
      });
    })();
  });

  // --- Host terminal / code-server relay (WS bridging caller <-> runner PTY) --
  // Same shape as the microvm relay but for a host runner session: the runner
  // spawns `command` under a PTY (tmux attach, or code-server) and streams
  // base64 termData frames. Query: ?runner=<name>&command=<shell>&cwd=<dir>.
  app.get("/runners/:name/term", { websocket: true }, (socket, req) => {
    const url = new URL(req.url, "http://internal");
    const name = (req.params as { name: string }).name;
    const command = url.searchParams.get("command") ?? "exec $SHELL";
    const cwd = url.searchParams.get("cwd") ?? "";
    void (async () => {
      const wsId = req.headers["x-twodb-workspace-id"] as string | undefined;
      if (!wsId) {
        socket.close(4401, "unauthorized");
        return;
      }
      const runner = hub.listOnline(wsId).find((r) => r.name === name);
      if (!runner) {
        socket.close(4409, "runner offline");
        return;
      }
      const callId = newId();
      const ack = await hub.sendToRunner(runner, { type: "termOpen", callId, command, cwd }, { timeoutMs: 15_000 }).catch(() => null);
      if (!ack || ack.error) {
        socket.close(1011, String((ack as any)?.error ?? "term failed to start"));
        return;
      }
      const unsub = hub.subscribe(callId, (frame) => {
        if (frame.type === "termData" && socket.readyState === socket.OPEN) {
          socket.send(frame.data as string); // already base64
        } else if (frame.type === "termClosed") {
          socket.close();
        }
      });
      socket.on("message", (raw: unknown) => {
        if (socket.readyState === socket.OPEN) {
          void hub.sendToRunner(runner, { type: "termWrite", callId, data: String(raw) }, { reply: false });
        }
      });
      socket.on("close", () => {
        unsub();
        void hub.sendToRunner(runner, { type: "termClose", callId }, { reply: false });
      });
    })();
  });

  // --- S3 (stubbed) -----------------------------------------------------------
  // Runners ship /app zips over their WS (vmArchive frames, handled in
  // ws/archive-store.ts). Callers can download one for inspection:
  app.get("/vm-archive/:identifier", async (req, reply) => {
    const ctx = requireCtx(req, reply);
    if (!ctx) return reply;
    const { identifier } = req.params as { identifier: string };
    const zip = await readLatestArchive(identifier);
    if (!zip) return reply.code(404).send({ error: "no archive" });
    reply.type("application/zip");
    return reply.send(zip);
  });

  app.get("/healthz", async () => ({ ok: true }));

  // --- Admin webapp: serve the built SPA when its dist exists (the release
  // image builds it; dev uses the Vite dev server on :6514 instead).
  const webappDist = path.join(import.meta.dirname, "../webapp/dist");
  if (existsSync(path.join(webappDist, "index.html"))) {
    await app.register(fastifyStatic, { root: webappDist, wildcard: false, index: false });
    app.setNotFoundHandler((req, reply) => {
      const pathname = new URL(req.url, "http://internal").pathname;
      const isApi = /^\/(runners|jobs|calls|exec|microvms|vm-archive|runner-ws|internal|healthz)(\/|$)/.test(pathname);
      if (req.method === "GET" && !isApi) return reply.sendFile("index.html");
      return reply.code(404).send({ error: "not found" });
    });
  }

  return app;
}
