import type { WebSocket } from "ws";
import type { FastifyInstance } from "fastify";
import { sha256 } from "../db/repository.js";
import type { DispatchRepo } from "../db/repository.js";

/**
 * The WS hub: every runner holds one long-lived socket to dispatch
 * (through the Gateway's WS passthrough). Each socket is a bidirectional
 * JSON-frame channel:
 *
 *   dispatch -> runner : {type:"exec", callId, ...} | {type:"job.*"...} | ping
 *   runner   -> dispatch: {type:"hello", key, name?, meta} | {type:"output",
 *                  callId, stream, chunk} | {type:"done", callId, exitCode}
 *                  | job events | {type:"pong"}
 *
 * Callers (browser/CLI) subscribe to callId outputs for `call` streaming and
 * terminal/VSCode relays — dispatch never lets callers talk to runners
 * directly, it always stays in the path (auth + audit live here).
 */

export interface RunnerSocket {
  runnerId: string;
  workspaceId: string;
  name: string;
  socket: WebSocket;
  lastSeen: number;
}

interface CallSubscriber {
  callId: string;
  /** stdout/stderr chunks + done events are pushed here. */
  send: (frame: Record<string, unknown>) => void;
}

export interface OutFrame {
  type: string;
  callId?: string;
  [k: string]: unknown;
}

export class DispatchHub {
  /** runnerId -> socket */
  private runners = new Map<string, RunnerSocket>();
  /** workspaceId+name -> runnerId (route by friendly name). */
  private byName = new Map<string, string>();
  /** callId -> waiting request (exec/call/job-create awaiting runner ack). */
  private pendingCalls = new Map<
    string,
    {
      runnerId: string;
      resolve: (frame: Record<string, unknown>) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  /** callId -> live subscriber pipes (call streaming, terminal, vscode). */
  private subscribers = new Map<string, Set<CallSubscriber["send"]>>();
  /** Sockets superseded by a reconnect — their close events are ignored. */
  private replaced = new Set<WebSocket>();

  constructor(private repo: DispatchRepo) {}

  registerRunner(runner: RunnerSocket): void {
    const prev = this.runners.get(runner.runnerId);
    if (prev) {
      // Mark the replaced socket so its close handler doesn't unregister
      // the fresh registration (dropRunner would wipe the new entry).
      this.replaced.add(prev.socket);
      try { prev.socket.close(); } catch { /* replaced */ }
      this.replaced.delete(prev.socket);
    }
    this.runners.set(runner.runnerId, runner);
    this.byName.set(`${runner.workspaceId}:${runner.name}`, runner.runnerId);
    void this.repo.runnerSeen(runner.runnerId, {}).catch(() => {});
  }

  /** True when the socket was superseded by a newer connection for the same
   *  runner — its close handler must not unregister. */
  isReplaced(socket: WebSocket): boolean {
    return this.replaced.has(socket);
  }

  async dropRunner(runnerId: string, socket?: WebSocket): Promise<void> {
    // Only drop when the dying socket is the one currently registered — a
    // stale close event from a superseded connection must not unregister
    // the fresh one.
    const current = this.runners.get(runnerId);
    if (current && socket && current.socket !== socket) return;
    this.runners.delete(runnerId);
    for (const [k, v] of this.byName) if (v === runnerId) this.byName.delete(k);
    await this.repo.runnerOffline(runnerId).catch(() => {});
  }

  getOnlineRunner(workspaceId: string, name: string): RunnerSocket | undefined {
    const id = this.byName.get(`${workspaceId}:${name}`);
    return id ? this.runners.get(id) : undefined;
  }

  isOnline(runnerId: string): boolean {
    return this.runners.has(runnerId);
  }

  listOnline(workspaceId: string): RunnerSocket[] {
    return [...this.runners.values()].filter((r) => r.workspaceId === workspaceId);
  }

  /**
   * Sends a frame and waits for the runner's reply with the same callId.
   * `timeoutMs` bounds the wait; `oneway` frames (job control, pings) skip
   * the reply map.
   */
  sendToRunner(runner: RunnerSocket, frame: OutFrame, opts: { reply?: boolean; timeoutMs?: number } = {}): Promise<Record<string, unknown> | null> {
    if (opts.reply === false) {
      runner.socket.send(JSON.stringify(frame));
      return Promise.resolve(null);
    }
    const callId = frame.callId as string;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(callId);
        reject(new Error(`runner "${runner.name}" did not answer call ${callId} within ${opts.timeoutMs ?? 30_000}ms`));
      }, opts.timeoutMs ?? 30_000);
      this.pendingCalls.set(callId, { runnerId: runner.runnerId, resolve, reject, timer });
      try {
        runner.socket.send(JSON.stringify(frame));
      } catch (err) {
        clearTimeout(timer);
        this.pendingCalls.delete(callId);
        reject(err as Error);
      }
    });
  }

  /** Runner answered a pending call — resolve it. */
  resolveCall(callId: string, frame: Record<string, unknown>): void {
    const p = this.pendingCalls.get(callId);
    if (!p) return;
    clearTimeout(p.timer);
    this.pendingCalls.delete(callId);
    p.resolve(frame);
  }

  failCall(callId: string, err: Error): void {
    const p = this.pendingCalls.get(callId);
    if (!p) return;
    clearTimeout(p.timer);
    this.pendingCalls.delete(callId);
    p.reject(err);
  }

  /** Fan a runner frame out to everyone subscribed to this callId. */
  publish(callId: string, frame: Record<string, unknown>): void {
    const subs = this.subscribers.get(callId);
    if (!subs) return;
    for (const send of subs) {
      try { send(frame); } catch { /* subscriber gone */ }
    }
  }

  subscribe(callId: string, send: CallSubscriber["send"]): () => void {
    let subs = this.subscribers.get(callId);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(callId, subs);
    }
    subs.add(send);
    return () => {
      subs.delete(send);
      if (subs.size === 0) this.subscribers.delete(callId);
    };
  }

  /** A runner socket died mid-stream — fail everything it owed us and
   *  notify subscribers so streams hang up cleanly. */
  async failRunnerCalls(runnerId: string): Promise<void> {
    for (const [callId, p] of this.pendingCalls) {
      if (p.runnerId !== runnerId) continue;
      clearTimeout(p.timer);
      this.pendingCalls.delete(callId);
      p.reject(new Error("runner disconnected"));
      const subs = this.subscribers.get(callId);
      if (subs) {
        for (const send of subs) {
          try { send({ type: "error", callId, error: "runner disconnected" }); } catch { /* gone */ }
        }
      }
    }
  }

  /** /app archive handlers (S3 stub) — see ws/archive-store.ts. */
  private vmArchiveHandler?: (frame: Record<string, unknown>, runner: { id: string }) => Promise<Record<string, unknown>>;

  onVmArchive(handler: (frame: Record<string, unknown>, runner: { id: string }) => Promise<Record<string, unknown>>): void {
    this.vmArchiveHandler = handler;
  }

  async handleVmArchive(frame: Record<string, unknown>, runner: { id: string }): Promise<Record<string, unknown>> {
    if (!this.vmArchiveHandler) return { error: "archive store unavailable" };
    return this.vmArchiveHandler(frame, runner);
  }
}

/** Extracts a runner by bearer runner-key from the WS upgrade request. */
export function parseRunnerAuth(url: URL, repo: DispatchRepo): Promise<{ key: string } | null> {
  const key = url.searchParams.get("key");
  if (!key) return Promise.resolve(null);
  return Promise.resolve({ key });
}

export function keyHash(key: string): string {
  return sha256(key);
}
