import { ulid } from "ulid";
import type { Kysely } from "kysely";
import type { ArtisanConfig } from "../config.js";
import { DispatchClient } from "../dispatch-client.js";
import { TworouteClient } from "../tworoute-client.js";
import { snapshotDirectory, restoreSnapshot } from "../checkpoints.js";
import type { ArtisanDb, AgentRow, SessionRow } from "../db/schema.js";
import type { ArtisanRepo } from "../db/repository.js";
import type { WorkspaceHub } from "../ws/hub.js";
import { abortSession, runAgentLoop, type CollabRunHooks, type RunDeps } from "../ws/agent-loop.js";
import { createToolkitClient } from "../toolkit-client.js";
import { createCanvasClient } from "../canvas.js";
import { createCollabRepo, type CollabRepo } from "./repo.js";
import { buildFrame, collabSystemPrompt } from "./frame.js";
import { collabTools, type CollabToolDeps, type RunState } from "./tools.js";
import {
  BOT_MSG, COLLAB_APP, REPLY_MSG, STATUS_MSG,
  type CancelPayload, type ReplyPayload, type RollbackPayload, type RunPayload,
} from "./types.js";

interface Log {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface CollabServiceDeps {
  db: Kysely<ArtisanDb>;
  repo: ArtisanRepo;
  hub: WorkspaceHub;
  config: ArtisanConfig;
  relay: CollabToolDeps["relay"];
  serviceFetch: CollabToolDeps["serviceFetch"];
  /** Credential provider for calling `audience` as this app inside a workspace (TwoDbSession.actAs). */
  actAs(audience: string, workspaceId: string): () => Promise<string>;
  log: Log;
}

export function createCollabService(d: CollabServiceDeps) {
  const collab: CollabRepo = createCollabRepo(d.db);

  // In-process bookkeeping for runs that are executing right now.
  const active = new Map<string, { runId: string; taskId: string; sessionId: string }>(); // runId -> …
  const cancelRequested = new Set<string>();
  const timedOut = new Set<string>();

  // One run at a time per task; later runs wait their turn (their lease keeps beating while they wait).
  const chains = new Map<string, Promise<unknown>>();
  function withTaskLock<T>(taskId: string, fn: () => Promise<T>): Promise<T> {
    const prev = chains.get(taskId) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(fn);
    const tail = run.catch(() => undefined);
    chains.set(taskId, tail);
    void tail.then(() => { if (chains.get(taskId) === tail) chains.delete(taskId); });
    return run;
  }

  const send = (type: string, workspaceId: string, payload: unknown, dedupeKey: string, botId?: string) =>
    d.relay.send({ app: COLLAB_APP, type, workspaceId, payload, dedupeKey, act: botId ? { type: "bot", id: botId } : undefined });

  const status = (p: RunPayload, state: "started" | "stopped" | "failed" | "idle", text?: string) =>
    send(STATUS_MSG, p.workspaceId, { runId: p.runId, taskId: p.taskId, epoch: p.epoch, channelId: p.channelId, botId: p.botId, state, text }, `${p.runId}:status:${state}`, p.botId).catch((err) => d.log.warn({ err }, "collab status send failed"));

  /** Clients for a run nobody is attending: they act as Artisan in the run's workspace on control-plane-signed tokens. */
  const clientsFor = (workspaceId: string) => ({
    tworoute: new TworouteClient(d.config, d.actAs("tworoute", workspaceId)),
    dispatch: new DispatchClient(d.config, d.actAs("dispatch", workspaceId)),
  });

  /** A reply the harness writes itself (failure / stop), so the user is never left in silence. */
  async function systemReply(p: RunPayload, outcome: "failed" | "stopped", text: string, sessionId: string | null, answered: string[] = []) {
    const run = await collab.getRun(p.runId);
    if (run?.replied) return;
    const messageId = ulid();
    const reply: ReplyPayload = {
      runId: p.runId, taskId: p.taskId, epoch: p.epoch, channelId: p.channelId, agentId: p.agentId, botId: p.botId, messageId,
      message: { text }, isCompleted: false, workNote: null, sessionId, answeredTriggers: answered, outcome,
    };
    await send(REPLY_MSG, p.workspaceId, reply, `${p.runId}:reply`, p.botId);
    await collab.patchRun(p.runId, { replied: 1, reply_message_id: messageId });
  }

  // -- inbox hook ------------------------------------------------------------
  /** Wraps relay.receive: a run is recorded as `queued` the moment it arrives, so cancel/coalescing can see it. */
  async function beforeReceive(type: string, workspaceId: string, payload: unknown): Promise<void> {
    if (type === "artisan.collab.run") await collab.insertRun({ ...(payload as RunPayload), workspaceId });
  }

  // -- the run ---------------------------------------------------------------
  async function executeRun(p: RunPayload): Promise<void> {
    let row = await collab.getRun(p.runId);
    if (!row) {
      await collab.insertRun(p);
      row = await collab.getRun(p.runId);
    }
    if (!row || row.state !== "queued") return; // cancelled, superseded, rolled back, or a redelivery of a finished run

    // Newer runs on this task already include this trigger in their snapshot: answer once, in the latest.
    if ((await collab.newerQueuedRuns(p.taskId, p.runId)).length) {
      await collab.transitionRun(p.runId, ["queued"], "superseded", { finished_at: new Date().toISOString() });
      return;
    }

    const task = await collab.upsertTask({ id: p.taskId, workspaceId: p.workspaceId, channelId: p.channelId, agentId: p.agentId, epoch: p.epoch });
    if (p.epoch < task.epoch) {
      await collab.transitionRun(p.runId, ["queued"], "cancelled", { finished_at: new Date().toISOString(), note: "stale epoch" });
      return;
    }
    if (Date.parse(p.deadlineAt) < Date.now()) {
      await collab.transitionRun(p.runId, ["queued"], "failed", { finished_at: new Date().toISOString(), note: "deadline passed in queue" });
      await systemReply(p, "failed", "I couldn't get to this in time. Please send it again.", task.session_id);
      return;
    }

    const agent = await d.repo.getAgent(p.workspaceId, p.agentId);
    if (!agent || agent.type !== "collaborator" || !agent.runner || !agent.directory) {
      await collab.transitionRun(p.runId, ["queued"], "failed", { finished_at: new Date().toISOString(), note: "collaborator not runnable" });
      await systemReply(p, "failed", "This collaborator isn't set up to run (it needs a runner and a directory).", task.session_id);
      return;
    }
    if (!(await collab.transitionRun(p.runId, ["queued"], "running", { started_at: new Date().toISOString() }))) return; // cancelled while we looked
    void status(p, "started");

    let sessionId: string | null = task.session_id;
    const state: RunState = { payload: p, sessionId: "", replied: false, replyMessageId: null, isCompleted: false, workNote: null, answeredTriggers: [], edits: 0 };
    let timer: NodeJS.Timeout | undefined;
    try {
      // Superseded runs are folded in.
      const folded = await collab.supersededSince(p.taskId, p.runId);
      state.answeredTriggers = [...folded.map((r) => r.trigger_message_id ?? ""), p.trigger.messageId].filter(Boolean);

      const deps: RunDeps = { repo: d.repo, hub: d.hub, canvas: d.serviceFetch ? createCanvasClient(d.serviceFetch) : undefined, ...(d.serviceFetch ? { toolkit: createToolkitClient(d.serviceFetch) } : {}), ...clientsFor(p.workspaceId) };

      // Session: resume the task's own, or start a new one.
      let session: SessionRow | undefined = sessionId ? await d.repo.getSession(p.workspaceId, sessionId) : undefined;
      if (session?.archived_at) session = undefined;
      const resumed = Boolean(session);
      if (!session) {
        const dir = await d.repo.getDirectoryByPath(p.workspaceId, agent.runner, agent.directory);
        const model = agent.model ?? dir?.default_model ?? null;
        if (!model) throw new Error("the collaborator has no model (set one on the agent, or a default model on its directory)");
        session = await d.repo.createSession({
          workspaceId: p.workspaceId, spaceId: agent.space_id, type: "collab", title: `chat · ${p.participants.filter((x) => x.type === "user").map((x) => x.name).join(", ") || p.channelId}`,
          runner: agent.runner, directory: agent.directory, model, interactive: false, agentId: agent.id, directoryId: dir?.id ?? null,
        });
        sessionId = session.id;
        await collab.patchTask(p.taskId, { session_id: session.id });
      }
      state.sessionId = session.id;
      active.set(p.runId, { runId: p.runId, taskId: p.taskId, sessionId: session.id });

      // Where this run starts in the session, and a file checkpoint — both are what rollback rewinds to.
      const thread = await d.repo.currentThread(session.id);
      if (!thread) throw new Error("session has no open thread");
      const startIdx = await collab.nextMessageIdx(thread.id);
      const snap = await snapshotDirectory(deps.dispatch, session.runner, session.directory).catch(() => ({ error: "failed" as const }));
      await collab.patchRun(p.runId, {
        session_id: session.id, thread_id: thread.id, start_idx: startIdx,
        checkpoint_ref: "ref" in snap ? snap.ref : null, checkpoint_sha: "sha" in snap ? snap.sha : null,
      });

      const hooks: CollabRunHooks = {
        extraTools: collabTools(state, { repo: collab, serviceFetch: d.serviceFetch, relay: d.relay }),
        systemExtra: collabSystemPrompt(p),
        shouldStop: () => state.replied,
        onIdle: (() => {
          let nudged = 0;
          return () => (nudged++ < 2 ? "You finished without sending a reply. Nothing you wrote is visible to the user. Call send_reply now (is_completed=false if you are still waiting for something)." : null);
        })(),
      };

      const remaining = Date.parse(p.deadlineAt) - Date.now();
      if (remaining > 0) timer = setTimeout(() => { timedOut.add(p.runId); abortSession(session!.id); }, remaining);

      await runAgentLoop({
        deps, session, agent, model: session.model,
        apiKey: "", // unused for collaborator runs: the clients in `deps` carry their own token provider
        userMessage: buildFrame(p, { resumed, supersededTriggers: state.answeredTriggers }),
        collab: hooks,
      });
    } catch (err) {
      d.log.error({ err, runId: p.runId }, "collab run failed");
      await collab.patchRun(p.runId, { note: String((err as Error).message ?? err).slice(0, 500) });
    } finally {
      if (timer) clearTimeout(timer);
      active.delete(p.runId);
    }

    // Outcome.
    const finished = new Date().toISOString();
    if (state.replied) {
      await collab.transitionRun(p.runId, ["running"], "done", { finished_at: finished });
      await collab.patchTask(p.taskId, { work_note: state.workNote });
    } else if (cancelRequested.delete(p.runId)) {
      await collab.transitionRun(p.runId, ["running"], "cancelled", { finished_at: finished });
      await systemReply(p, "stopped", "Stopped. Anything I'd already changed on disk is still there.", sessionId, state.answeredTriggers);
      void status(p, "stopped");
    } else {
      const was = timedOut.delete(p.runId);
      const run = await collab.getRun(p.runId);
      await collab.transitionRun(p.runId, ["running"], "failed", { finished_at: finished });
      await systemReply(p, "failed", was ? "I ran out of time on this. The task is still open — tell me to continue and I'll pick it up." : `I couldn't finish this${run?.note ? `: ${run.note}` : "."} The task is still open; you can try again.`, sessionId, state.answeredTriggers);
      void status(p, "failed");
    }
  }

  // -- cancel / rollback -------------------------------------------------------
  async function cancelRun(c: CancelPayload): Promise<void> {
    const run = await collab.getRun(c.runId);
    if (!run) {
      // Cancel arrived before its run: leave a tombstone so the run never starts.
      return;
    }
    if (await collab.transitionRun(c.runId, ["queued"], "cancelled", { finished_at: new Date().toISOString(), note: "cancelled before start" })) {
      const p = JSON.parse(run.payload_json) as RunPayload;
      await systemReply(p, "stopped", "Stopped before I started.", null);
      void status(p, "stopped");
      return;
    }
    if (run.state === "running") {
      cancelRequested.add(c.runId);
      const a = active.get(c.runId);
      if (a) abortSession(a.sessionId);
    }
  }

  async function rollback(r: RollbackPayload): Promise<void> {
    // 1. Bump the epoch and stop anything in flight BEFORE taking the task lock (a running run holds it).
    const task = await collab.getTask(r.taskId);
    if (!task) return;
    await collab.patchTask(r.taskId, { epoch: Math.max(task.epoch, r.newEpoch) });
    const inFlight = await d.db.selectFrom("collab_run").selectAll().where("task_id", "=", r.taskId).where("state", "in", ["queued", "running"]).execute();
    for (const run of inFlight) {
      if (run.state === "queued") await collab.transitionRun(run.run_id, ["queued"], "cancelled", { finished_at: new Date().toISOString(), note: "rolled back" });
      else {
        cancelRequested.add(run.run_id);
        const a = active.get(run.run_id);
        if (a) abortSession(a.sessionId);
      }
    }

    await withTaskLock(r.taskId, async () => {
      if (!r.fromRunId) return;
      const runs = await collab.runsFrom(r.taskId, r.fromRunId);
      const first = runs[0];
      if (!first) return;

      // 2. Rewind the session to just before the first undone run — or give it up when that is no longer possible.
      const t = await collab.getTask(r.taskId);
      const session = t?.session_id ? await d.repo.getSession(task.workspace_id, t.session_id) : undefined;
      if (session) {
        const current = await d.repo.currentThread(session.id);
        if (current && first.thread_id === current.id && first.start_idx !== null) {
          await collab.deleteMessagesFrom(current.id, first.start_idx);
        } else {
          await collab.patchTask(r.taskId, { session_id: null }); // compacted / reset since: the next run starts fresh from the snapshot
        }
        // 3. Files, only when asked, and only where a checkpoint exists.
        if (r.restoreFiles && first.checkpoint_ref) {
          const res = await restoreSnapshot(clientsFor(task.workspace_id).dispatch, session.runner, session.directory, first.checkpoint_ref, { removeNew: true });
          if (!res.ok) d.log.warn({ taskId: r.taskId, error: res.error }, "rollback: file restore failed");
        }
      }
      for (const run of runs) await collab.transitionRun(run.run_id, ["queued", "running", "done", "failed", "cancelled", "superseded"], "rolled_back", { finished_at: run.finished_at ?? new Date().toISOString() });
    });
  }

  // -- bots ----------------------------------------------------------------
  const runnable = (a: AgentRow) => a.type === "collaborator" && Boolean(a.runner && a.directory);

  /** Tell TwoChat this collaborator exists (or changed). Idempotent per agent revision. */
  async function syncBot(a: AgentRow): Promise<void> {
    if (a.type !== "collaborator") return;
    await send(BOT_MSG, a.workspace_id, { agentId: a.id, name: a.name, description: a.description, enabled: runnable(a), deleted: false }, `${a.id}:${a.updated_at}`);
  }

  async function removeBot(workspaceId: string, agentId: string): Promise<void> {
    await send(BOT_MSG, workspaceId, { agentId, name: "", description: "", enabled: false, deleted: true }, `${agentId}:deleted`);
  }

  async function syncAllBots(): Promise<number> {
    const agents = await collab.listCollaboratorAgents();
    for (const a of agents) await syncBot(a).catch((err) => d.log.warn({ err, agentId: a.id }, "bot sync failed"));
    return agents.length;
  }

  /** Runs left `running` by a process that died: fail them visibly. */
  async function failStaleRuns(): Promise<void> {
    for (const run of await collab.staleRunning(5 * 60_000)) {
      if (active.has(run.run_id)) continue;
      const p = JSON.parse(run.payload_json) as RunPayload;
      if (await collab.transitionRun(run.run_id, ["running"], "failed", { finished_at: new Date().toISOString(), note: "worker restarted" })) {
        await systemReply(p, "failed", "I was interrupted (the service restarted). The task is still open; you can try again.", run.session_id);
        void status(p, "failed");
      }
    }
  }

  /** onDead for the run job: the queue gave up (worker died mid-run) — make sure the user hears about it. */
  async function onRunDead(payload: unknown, error: string): Promise<void> {
    const p = payload as RunPayload;
    if (!p?.runId) return;
    const run = await collab.getRun(p.runId);
    if (!run || run.state === "done" || run.state === "rolled_back" || run.state === "cancelled" || run.state === "superseded") return;
    await collab.transitionRun(p.runId, ["queued", "running"], "failed", { finished_at: new Date().toISOString(), note: error.slice(0, 300) });
    await systemReply(p, "failed", "I was interrupted before I could finish. The task is still open; you can try again.", run.session_id);
    void status(p, "failed");
  }

  return {
    repo: collab,
    beforeReceive,
    runJob: (payload: RunPayload) => withTaskLock(payload.taskId, () => executeRun(payload)),
    cancelRun,
    rollback,
    syncBot,
    removeBot,
    syncAllBots,
    failStaleRuns,
    onRunDead,
    isRunning: (runId: string) => active.has(runId),
  };
}

export type CollabService = ReturnType<typeof createCollabService>;
