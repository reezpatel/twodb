import type { FastifyReply } from "fastify";
import type { CodeSessionEvent } from "../shared/api";

const EVENT_CAP = 500;
const RUNTIME_TTL_MS = 30 * 60 * 1000;
const KEEPALIVE_MS = 15_000;

type SessionRuntime = {
  events: CodeSessionEvent[];
  subscribers: Set<(event: CodeSessionEvent) => void>;
  runningRunId: string | null;
  closedAt: number | null;
};

export class CodeRuntime {
  private sessions = new Map<string, SessionRuntime>();
  private sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, runtime] of this.sessions) {
        if (!runtime.runningRunId && runtime.closedAt != null && now - runtime.closedAt > RUNTIME_TTL_MS) {
          this.sessions.delete(sessionId);
        }
      }
    }, 60_000);
    this.sweeper.unref();
  }

  isRunning(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.runningRunId != null;
  }

  begin(sessionId: string, runId: string): boolean {
    const runtime = this.ensure(sessionId);
    if (runtime.runningRunId) return false;
    runtime.runningRunId = runId;
    runtime.closedAt = null;
    return true;
  }

  finish(sessionId: string): void {
    const runtime = this.ensure(sessionId);
    runtime.runningRunId = null;
    runtime.closedAt = Date.now();
  }

  emit(sessionId: string, event: CodeSessionEvent): void {
    const runtime = this.ensure(sessionId);
    runtime.events.push(event);
    if (runtime.events.length > EVENT_CAP) runtime.events.splice(0, runtime.events.length - EVENT_CAP);
    for (const subscriber of runtime.subscribers) subscriber(event);
  }

  events(sessionId: string): CodeSessionEvent[] {
    return this.sessions.get(sessionId)?.events ?? [];
  }

  // Bulk-load persisted history into an empty buffer (after api restarts).
  // No-op when the buffer already holds live events.
  seed(sessionId: string, events: CodeSessionEvent[]): void {
    const runtime = this.ensure(sessionId);
    if (runtime.events.length > 0 || events.length === 0) return;
    runtime.events.push(...events);
    for (const subscriber of runtime.subscribers) {
      for (const event of events) subscriber(event);
    }
  }

  // Socket-oriented subscription: returns a detach function. Callers send
  // the snapshot themselves (events()) — unlike subscribe(), which owns the
  // SSE response lifecycle.
  attach(sessionId: string, onEvent: (event: CodeSessionEvent) => void): () => void {
    const runtime = this.ensure(sessionId);
    runtime.subscribers.add(onEvent);
    return () => {
      runtime.subscribers.delete(onEvent);
    };
  }

  subscribe(sessionId: string, reply: FastifyReply): void {
    const runtime = this.ensure(sessionId);

    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    const write = (event: CodeSessionEvent) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    for (const event of runtime.events) write(event);

    const keepAlive = setInterval(() => reply.raw.write(": ka\n\n"), KEEPALIVE_MS);
    runtime.subscribers.add(write);
    reply.raw.on("close", () => {
      clearInterval(keepAlive);
      runtime.subscribers.delete(write);
    });
  }

  private ensure(sessionId: string): SessionRuntime {
    let runtime = this.sessions.get(sessionId);
    if (!runtime) {
      runtime = { events: [], subscribers: new Set(), runningRunId: null, closedAt: null };
      this.sessions.set(sessionId, runtime);
    }
    return runtime;
  }
}

export const runtime = new CodeRuntime();
