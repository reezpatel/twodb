import type { WSContext } from "hono/ws";
import { logger } from "./logger";

interface RunnerConnection {
  runnerId: string;
  organizationId: string;
  name: string;
  ws: WSContext;
}

interface TerminalSession {
  sessionId: string;
  runnerId: string;
  client: WSContext;
}

interface ExecHandlers {
  resolve: (result: { stdout: string; stderr: string; code: number }) => void;
  reject: (error: Error) => void;
  onChunk?: (stream: "stdout" | "stderr", data: string) => void;
  stdout: string;
  stderr: string;
}

function send(ws: WSContext, msg: unknown) {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // connection already gone
  }
}

class RunnerManager {
  private runners = new Map<string, RunnerConnection>();
  private terminals = new Map<string, TerminalSession>();
  private clientSessions = new Map<WSContext, string>();
  private execs = new Map<string, ExecHandlers>();
  private changeListeners = new Set<() => void>();

  /** Fires whenever a runner connects or disconnects. */
  onChange(cb: () => void) {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  private notifyChanged() {
    for (const cb of this.changeListeners) cb();
  }

  /** Resolves when the runner connects, or false after timeoutMs. */
  private async waitForRunner(runnerId: string, timeoutMs: number): Promise<boolean> {
    if (this.runners.has(runnerId)) return true;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.changeListeners.delete(changed);
        resolve(false);
      }, timeoutMs);
      const changed = () => {
        if (!this.runners.has(runnerId)) return;
        clearTimeout(timer);
        this.changeListeners.delete(changed);
        resolve(true);
      };
      this.changeListeners.add(changed);
    });
  }

  /**
   * Runs a shell command on a runner; streams output chunks, resolves with the
   * full capture. If the runner is offline, waits up to `waitMs` for it to
   * reconnect (default 60 min) before failing.
   */
  async execOnRunner(
    runnerId: string,
    command: string,
    onChunk?: (stream: "stdout" | "stderr", data: string) => void,
    opts: { waitMs?: number; onWaiting?: () => void } = {},
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    const waitMs = opts.waitMs ?? 60 * 60 * 1000;
    if (!this.runners.has(runnerId)) {
      opts.onWaiting?.();
      const back = await this.waitForRunner(runnerId, waitMs);
      if (!back) {
        logger.warn({ runnerId, waitedMs: waitMs }, "runner exec failed: offline (waited for reconnect)");
        return Promise.reject(new Error("runner offline (waited for reconnect)"));
      }
    }

    const runner = this.runners.get(runnerId);
    if (!runner) {
      logger.warn({ runnerId }, "runner exec failed: offline");
      return Promise.reject(new Error("runner offline"));
    }

    const execId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.execs.set(execId, { resolve, reject, onChunk, stdout: "", stderr: "" });
      send(runner.ws, { type: "exec", execId, command });
    });
  }

  private handleExecChunk(msg: {
    execId?: string;
    stream?: string;
    data?: string;
  }) {
    if (!msg.execId) return;
    const pending = this.execs.get(msg.execId);
    if (!pending) return;
    if (msg.stream === "stdout") {
      pending.stdout += msg.data ?? "";
      pending.onChunk?.("stdout", msg.data ?? "");
    } else if (msg.stream === "stderr") {
      pending.stderr += msg.data ?? "";
      pending.onChunk?.("stderr", msg.data ?? "");
    }
  }

  private handleExecResult(msg: { execId?: string; stdout?: string; stderr?: string; code?: number; message?: string }) {
    if (!msg.execId) return;
    const pending = this.execs.get(msg.execId);
    if (!pending) return;
    this.execs.delete(msg.execId);
    if (msg.code === undefined) {
      logger.error({ execId: msg.execId, message: msg.message }, "runner exec errored");
      pending.reject(new Error(msg.message ?? "runner exec error"));
    } else {
      pending.resolve({
        stdout: msg.stdout ?? pending.stdout,
        stderr: msg.stderr ?? pending.stderr,
        code: msg.code,
      });
    }
  }

  addRunner(conn: RunnerConnection) {
    this.runners.set(conn.runnerId, conn);
    this.notifyChanged();
  }

  removeRunner(runnerId: string) {
    this.runners.delete(runnerId);
    this.notifyChanged();
    for (const [sessionId, t] of this.terminals) {
      if (t.runnerId === runnerId) {
        send(t.client, { type: "error", message: "runner disconnected" });
        this.clientSessions.delete(t.client);
        this.terminals.delete(sessionId);
      }
    }
  }

  isOnline(runnerId: string) {
    return this.runners.has(runnerId);
  }

  onlineIds(): Set<string> {
    return new Set(this.runners.keys());
  }

  disconnect(runnerId: string) {
    const conn = this.runners.get(runnerId);
    if (conn) send(conn.ws, { type: "close" });
  }

  openTerminal(sessionId: string, runnerId: string, client: WSContext) {
    const runner = this.runners.get(runnerId);
    if (!runner) return false;
    this.terminals.set(sessionId, { sessionId, runnerId, client });
    this.clientSessions.set(client, sessionId);
    return true;
  }

  toRunner(sessionId: string, msg: unknown) {
    const terminal = this.terminals.get(sessionId);
    if (!terminal) return;
    const runner = this.runners.get(terminal.runnerId);
    if (runner) send(runner.ws, msg);
  }

  fromRunner(runnerId: string, msg: { type: string; sessionId?: string; execId?: string }) {
    if (msg.type === "execChunk") {
      this.handleExecChunk(msg);
      return;
    }
    if (msg.type === "execResult") {
      this.handleExecResult(msg);
      return;
    }
    if (!msg.sessionId) return;
    const terminal = this.terminals.get(msg.sessionId);
    if (!terminal || terminal.runnerId !== runnerId) return;
    send(terminal.client, msg);
    if (msg.type === "exit") {
      this.clientSessions.delete(terminal.client);
      this.terminals.delete(msg.sessionId);
    }
  }

  detachClient(client: WSContext) {
    const sessionId = this.clientSessions.get(client);
    if (!sessionId) return;
    this.clientSessions.delete(client);
    this.terminals.delete(sessionId);
    this.toRunner(sessionId, { type: "close", sessionId });
  }
}

export const runnerManager = new RunnerManager();
