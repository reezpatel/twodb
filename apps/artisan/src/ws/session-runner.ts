import type { ArtisanRepo } from "../db/repository.js";
import { runAgentLoop, abortSession, type RunDeps } from "./agent-loop.js";
import type { ServerFrameBody } from "./hub.js";

/**
 * Server-side session runtime: message queue, active run and pending
 * ask_user live here, NOT in any client. A client is only a viewer — it may
 * disconnect at any time and a reconnecting client re-syncs everything from
 * `snapshot()` (running, queued messages, live ask) plus a state frame on
 * join. This fixes the client-side queue losing messages on refresh/restart
 * and lets every viewer of a session see the same queue.
 */

export interface QueueItem {
  id: string;
  content: string;
}

interface AskInfo {
  askId: string;
  questions: Array<{ question: string; options?: string[]; allowMultiple?: boolean }>;
}

interface SessionRuntime {
  queue: QueueItem[];
  running: boolean;
  ask: AskInfo | null;
  /** Queued messages dispatch as one joined user turn when the run ends. */
  draining: boolean;
}

export interface RunContext {
  repo: ArtisanRepo;
  depsFor: (workspaceId: string, key: string) => RunDeps;
  /** Runs started over the WS / drained after the last viewer left have no
   * user key — they mint a per-call service token (TwoDbSession.actAs). */
  keyFor: (workspaceId: string) => () => Promise<string>;
}

export class SessionRunner {
  private rt = new Map<string, SessionRuntime>();

  constructor(private ctx: RunContext) {}

  private runtime(sessionId: string): SessionRuntime {
    let r = this.rt.get(sessionId);
    if (!r) {
      r = { queue: [], running: false, ask: null, draining: false };
      this.rt.set(sessionId, r);
    }
    return r;
  }

  /** Wraps a run's emit: broadcasts the frame AND tracks run/ask state so a
   * (re)joining client can be caught up. Any run — HTTP, WS, queued drain,
   * even a session-opening message — goes through this. */
  private wrapEmit(workspaceId: string, sessionId: string, deps: RunDeps): (frame: ServerFrameBody) => void {
    const hub = deps.hub;
    const r = this.runtime(sessionId);
    return (frame) => {
      if (frame.type === "run_start") r.running = true;
      else if (frame.type === "ask_user") r.ask = { askId: frame.askId, questions: frame.questions };
      else if (frame.type === "ask_resolved") r.ask = null;
      else if (frame.type === "done") {
        r.running = false;
        r.ask = null;
        queueMicrotask(() => void this.drain(workspaceId, sessionId));
      }
      hub.broadcast(workspaceId, sessionId, frame);
    };
  }

  /** What a (re)joining client needs to reconstruct live state. */
  snapshot(sessionId: string): { running: boolean; queue: QueueItem[]; ask: AskInfo | null } {
    const r = this.rt.get(sessionId);
    return { running: r?.running ?? false, queue: r?.queue ?? [], ask: r?.ask ?? null };
  }

  listQueue(sessionId: string): QueueItem[] {
    return this.rt.get(sessionId)?.queue ?? [];
  }

  removeQueued(sessionId: string, itemId: string): boolean {
    const r = this.rt.get(sessionId);
    if (!r) return false;
    const before = r.queue.length;
    r.queue = r.queue.filter((q) => q.id !== itemId);
    return r.queue.length !== before;
  }

  clearQueue(sessionId: string): void {
    const r = this.rt.get(sessionId);
    if (r) r.queue = [];
  }

  /** True when the run slot is free: /new, /compact and delete wait for this. */
  isIdle(sessionId: string): boolean {
    const r = this.rt.get(sessionId);
    return !r || (!r.running && !r.draining);
  }

  /** Enqueue a user message; dispatches immediately when nothing is running. */
  async enqueue(workspaceId: string, sessionId: string, content: string): Promise<{ queued: boolean }> {
    const r = this.runtime(sessionId);
    r.queue.push({ id: crypto.randomUUID(), content });
    if (!r.running && !r.draining) void this.drain(workspaceId, sessionId);
    return { queued: r.running || r.draining };
  }

  /** "Send now": the queued messages go next; the current run is aborted so
   * they fire as soon as its done frame lands. Nothing to abort → the drain
   * effect takes them right away. */
  async sendNow(workspaceId: string, sessionId: string): Promise<void> {
    const r = this.runtime(sessionId);
    if (r.queue.length === 0) return;
    if (r.running && abortSession(sessionId)) return; // done frame drains
    if (!r.draining) void this.drain(workspaceId, sessionId);
  }

  /** Joins every queued message into one user turn and starts the run. */
  private async drain(workspaceId: string, sessionId: string): Promise<void> {
    const r = this.runtime(sessionId);
    if (r.running || r.draining || r.queue.length === 0) return;
    r.draining = true;
    try {
      const session = await this.ctx.repo.getSession(workspaceId, sessionId);
      const agent = session ? await this.ctx.repo.agentForSession(session) : null;
      if (!session || !agent) {
        if (r.queue.length > 0) this.emitError(workspaceId, sessionId, agent ? "session not found" : "agent config missing");
        r.queue = [];
        return;
      }
      while (!r.running && r.queue.length > 0) {
        const items = r.queue.splice(0);
        const content = items.map((i) => i.content).join("\n\n");
        // Fresh service token + clients per run — tokens are short-lived.
        const key = await this.ctx.keyFor(workspaceId)();
        const deps = this.ctx.depsFor(workspaceId, key);
        try {
          await runAgentLoop({
            deps,
            session, agent, model: session.model,
            apiKey: key,
            userMessage: content,
            emitOverride: this.wrapEmit(workspaceId, sessionId, deps),
          });
        } catch (err) {
          this.emitError(workspaceId, sessionId, (err as Error).message);
          await this.recordFailure(sessionId, err);
        }
      }
    } finally {
      r.draining = false;
    }
  }

  private emitError(workspaceId: string, sessionId: string, message: string): void {
    const hub = this.ctx.depsFor(workspaceId, "").hub;
    hub.broadcast(workspaceId, sessionId, { type: "error", message });
    hub.broadcast(workspaceId, sessionId, { type: "done", ok: false, message });
  }

  private async recordFailure(sessionId: string, err: unknown): Promise<void> {
    console.error("agent loop failed:", err);
    const t = await this.ctx.repo.currentThread(sessionId);
    if (t) await this.ctx.repo.addMessage({ threadId: t.id, sessionId, role: "assistant", content: `(run failed: ${(err as Error).message})`, meta: { error: true } });
  }
}

