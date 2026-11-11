import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { newId, sha256 } from "../db/repository.js";
import type { RunnerRow } from "../db/schema.js";
import { readLatestArchive } from "./archive-store.js";
import type { DispatchHub } from "./hub.js";

/**
 * The runner-side WS endpoint: `/runner-ws?key=twodbrun_...`.
 *
 * Auth is the runner key (hash lookup) — the Gateway's WS passthrough
 * (see apps/twodb gateway) bridges upgrade requests here *without* session
 * auth: runner keys are dispatch's own credential space, issued per runner
 * and shown once at creation. The workspace is whatever workspace created
 * the runner, so a runner can never escape its workspace.
 *
 * Frame protocol (JSON, one per WS message):
 *   runner -> dispatch:
 *     {type:"hello", name?, meta, kind?}                    first frame, acks auth
 *     {type:"pong"}
 *     {type:"result", callId, ...}                          reply to a request frame
 *     {type:"output", callId, stream, chunk}                streamed output for a call
 *     {type:"jobLog", jobId, seq, stream, line}             append job log (no reply)
 *     {type:"jobStatus", jobId, status, exitCode?}          job lifecycle updates
 *     {type:"vmEvent", identifier, event, detail?}          microvm lifecycle updates
 *   dispatch -> runner:
 *     {type:"ping"}                                         liveness (10s)
 *     {type:"exec", callId, command, cwd?, env?, timeoutMs?}
 *     {type:"call", callId, command, cwd?, env?, timeoutMs?}
 *     {type:"jobCreate", callId, jobId, command, cwd?, env?}
 *     {type:"jobSignal", jobId, signal: "terminate"}
 *     {type:"vmBoot", callId, identifier, cid, kernel?, rootfs?, memMb?, vcpu?}
 *     {type:"vmShutdown", identifier, archive: true|false}
 *     {type:"vmExec", callId, identifier, command, timeoutMs?}
 *     {type:"vmStream", callId, identifier, mode:"terminal"|"vscode"}
 *     {type:"vmWrite", callId, data}                        input into a vmStream
 */

let hub: DispatchHub;
let repo: import("../db/repository.js").DispatchRepo;

export function registerRunnerWs(app: FastifyInstance, hubArg: DispatchHub, repoArg: import("../db/repository.js").DispatchRepo): void {
  hub = hubArg;
  repo = repoArg;
  app.get("/runner-ws", { websocket: true }, (socket: WebSocket, req) => {
    const url = new URL(req.url, "http://internal");
    const key = url.searchParams.get("key");
    // Frames can beat the auth lookup across the wire — queue everything
    // that arrives before the runner row resolves, then replay.
    let ready = false;
    const early: unknown[] = [];
    const onEarly = (raw: unknown) => early.push(raw);
    socket.on("message", onEarly);
    void (async () => {
      if (!key) return socket.close(4401, "missing runner key");
      const runner = await repo.getRunnerByKey(key).catch(() => undefined);
      if (!runner) return socket.close(4401, "unknown runner key");

      socket.removeListener("message", onEarly);
      ready = true;
      void ready;
      // register the real handler, then replay anything queued during auth
      const onMessage = (raw: unknown) => handleFrame(socket, runner, raw);
      socket.on("message", onMessage);
      for (const raw of early) onMessage(raw);

      await onRunnerConnected(socket, runner);

      const pingTimer = setInterval(() => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
      }, 10_000);
      socket.on("close", () => {
        clearInterval(pingTimer);
        void hub.dropRunner(runner.id, socket);
        void hub.failRunnerCalls(runner.id);
      });
      socket.on("error", () => {
        clearInterval(pingTimer);
        void hub.dropRunner(runner.id, socket);
        void hub.failRunnerCalls(runner.id);
      });
    })();
  });
}

/** Post-auth wiring: hello handling lives in handleFrame; this registers the
 *  socket in the hub if hello already arrived during replay. */
async function onRunnerConnected(socket: WebSocket, runner: RunnerRow): Promise<void> {
  void socket;
  void runner;
}

/** One decoded frame from a runner. */
function handleFrame(socket: WebSocket, runner: RunnerRow, raw: unknown): void {
  let frame: any;
  try {
    frame = JSON.parse(String(raw));
  } catch {
    return;
  }
  const repo_ = repo;
  const hub_ = hub;
  const registered = hub_.isOnline(runner.id);
  switch (frame.type) {
    case "hello": {
      void (async () => {
        if (typeof frame.name === "string" && frame.name && frame.name !== runner.name) {
          const taken = await repo_.getRunnerByName(runner.workspace_id, frame.name);
          if (taken && taken.id !== runner.id) {
            return socket.close(4409, `runner name "${frame.name}" already taken`);
          }
          await repo_.touchRunnerName(runner.id, frame.name).catch(() => {});
          runner.name = frame.name;
        }
        if (typeof frame.kind === "string" && (frame.kind === "host" || frame.kind === "microvm-host")) {
          await repo_.touchRunnerKind(runner.id, frame.kind).catch(() => {});
        }
        const meta = typeof frame.meta === "object" && frame.meta ? frame.meta : {};
        hub_.registerRunner({
          runnerId: runner.id,
          workspaceId: runner.workspace_id,
          name: runner.name,
          socket,
          lastSeen: Date.now(),
        });
        void repo_.runnerSeen(runner.id, meta).catch(() => {});
        socket.send(JSON.stringify({ type: "helloAck", name: runner.name, workspaceId: runner.workspace_id }));
      })();
      return;
    }
    case "pong":
      return;
    case "result": {
      hub_.resolveCall(String(frame.callId), frame);
      return;
    }
    case "output": {
      const callIdOut = String(frame.callId);
      void repo_
        .appendExecLog({
          workspaceId: runner.workspace_id,
          runnerId: runner.id,
          resourceId: null,
          command: "",
          stream: frame.stream === "stderr" ? "stderr" : "stdout",
          chunk: String(frame.chunk ?? ""),
        })
        .catch(() => {});
      hub_.publish(callIdOut, { type: "output", callId: callIdOut, stream: frame.stream, chunk: frame.chunk });
      return;
    }
    case "jobLog": {
      if (!registered) return;
      void repo_
        .appendJobLog({
          jobId: String(frame.jobId),
          seq: Number(frame.seq),
          stream: frame.stream === "stderr" ? "stderr" : "stdout",
          line: String(frame.line ?? ""),
        })
        .catch(() => {});
      hub_.publish(`job:${frame.jobId}`, { type: "jobLog", jobId: frame.jobId, seq: frame.seq, stream: frame.stream, line: frame.line });
      return;
    }
    case "jobStatus": {
      if (!registered) return;
      void repo_.finishJob(String(frame.jobId), frame.status, frame.exitCode ?? null).catch(() => {});
      hub_.publish(`job:${frame.jobId}`, { type: "jobStatus", jobId: frame.jobId, status: frame.status, exitCode: frame.exitCode });
      return;
    }
    case "vmArchive": {
      void hub_
        .handleVmArchive(frame, { id: runner.id })
        .then((res) => {
          if (frame.callId) socket.send(JSON.stringify({ type: "result", callId: frame.callId, ...res }));
        })
        .catch((err: Error) => {
          if (frame.callId) socket.send(JSON.stringify({ type: "result", callId: frame.callId, error: err.message }));
        });
      return;
    }
    case "vmArchiveGet": {
      void (async () => {
        const zip = await readLatestArchive(String(frame.identifier ?? "")).catch(() => null);
        if (!zip) {
          socket.send(JSON.stringify({ type: "result", callId: frame.callId, error: "no archive" }));
          return;
        }
        const chunk = 48 * 1024;
        for (let off = 0; off < zip.length; off += chunk) {
          const end = Math.min(off + chunk, zip.length);
          socket.send(JSON.stringify({
            type: "vmArchiveData", callId: frame.callId, data: zip.subarray(off, end).toString("base64"),
          }));
        }
        socket.send(JSON.stringify({ type: "result", callId: frame.callId, done: true, size: zip.length }));
      })();
      return;
    }
    case "vmEvent": {
      void (async () => {
        const vm = await repo_.getMicrovm(runner.workspace_id, String(frame.identifier)).catch(() => undefined);
        if (vm) {
          const patch: Record<string, unknown> = { last_active_at: new Date().toISOString() };
          if (frame.event === "stopped") patch.status = frame.archived ? "archived" : "idle-stopped";
          else if (frame.event === "started") {
            patch.status = "running";
            patch.boot_count = vm.boot_count + 1;
          } else if (frame.event === "failed") patch.status = "failed";
          await repo_.touchMicrovm(vm.id, patch as any).catch(() => {});
        } else if (frame.event === "removed") {
          await repo_.deleteMicrovm(runner.workspace_id, String(frame.identifier)).catch(() => {});
        }
        hub_.publish(`vm:${frame.identifier}`, { type: "vmEvent", identifier: frame.identifier, event: frame.event, detail: frame.detail });
      })();
      return;
    }
    default:
      return;
  }
}

export { sha256 };
