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

/** Pending job-protocol requests keyed by jobId — spawn acks, output tails, kills. */
interface JobPending {
  spawn?: {
    resolve: (r: { logPath: string }) => void;
    reject: (e: Error) => void;
  };
  output?: {
    resolve: (r: { output: string; unknown?: boolean }) => void;
    reject: (e: Error) => void;
  };
  kill?: {
    resolve: (r: { unknown?: boolean }) => void;
    reject: (e: Error) => void;
  };
  /** Fires once when the runner reports the job's exit (jobResult). */
  onExit?: (info: { code: number | null; signal?: string; message?: string }) => void;
}

/** Pending AWS-bridge requests keyed by requestId. */
interface AwsPending {
  /** Resolves on awsStatusResult / awsLoginResult / awsSelectResult. */
  resolve: (r: unknown) => void;
  reject: (e: Error) => void;
  /** Login is two-phase: code first (awsLoginCode), completion second. */
  onCode?: (start: { userCode: string; verificationUri: string; verificationUriComplete: string | null; expiresInSeconds: number }) => void;
  timer?: ReturnType<typeof setTimeout>;
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
  private jobPending = new Map<string, JobPending>();
  private awsPending = new Map<string, AwsPending>();
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

  /** Detached spawn on a runner — resolves as soon as the job is launched
   * (with its log path); completion arrives later via onExit. */
  async spawnJobOnRunner(
    runnerId: string,
    jobId: string,
    command: string,
    opts: { cwd?: string | null; onExit?: (info: { code: number | null; signal?: string; message?: string }) => void } = {},
  ): Promise<{ logPath: string }> {
    const runner = this.runners.get(runnerId);
    if (!runner) return Promise.reject(new Error("runner offline"));
    return new Promise((resolve, reject) => {
      this.jobPending.set(jobId, {
        spawn: { resolve, reject },
        ...(opts.onExit ? { onExit: opts.onExit } : {}),
      });
      send(runner.ws, { type: "spawnJob", jobId, command, ...(opts.cwd ? { cwd: opts.cwd } : {}) });
    });
  }

  /** Last N lines of a job's log — works for running and finished jobs alike. */
  async jobOutput(runnerId: string, jobId: string, opts: { lines?: number; from?: number; to?: number } = {}): Promise<{ output: string; totalLines?: number; unknown?: boolean }> {
    const runner = this.runners.get(runnerId);
    if (!runner) return Promise.reject(new Error("runner offline"));
    return new Promise((resolve, reject) => {
      const pending = this.jobPending.get(jobId);
      if (pending?.output || pending?.kill) return reject(new Error("job request already pending"));
      this.jobPending.set(jobId, {
        ...pending,
        output: { resolve, reject },
      });
      send(runner.ws, { type: "jobOutput", jobId, lines: opts.lines, from: opts.from, to: opts.to });
    });
  }

  /** Signal the job's process group; resolves whether or not the job was known. */
  async killJob(runnerId: string, jobId: string): Promise<{ unknown?: boolean }> {
    const runner = this.runners.get(runnerId);
    if (!runner) return Promise.reject(new Error("runner offline"));
    return new Promise((resolve, reject) => {
      const pending = this.jobPending.get(jobId);
      if (pending?.output || pending?.kill) return reject(new Error("job request already pending"));
      this.jobPending.set(jobId, {
        ...pending,
        kill: { resolve, reject },
      });
      send(runner.ws, { type: "jobKill", jobId });
    });
  }

  private handleJobMessage(msg: { type: string; jobId?: string; logPath?: string; output?: string; totalLines?: number; unknown?: boolean; code?: number; signal?: string; message?: string }) {
    if (!msg.jobId) return;
    const pending = this.jobPending.get(msg.jobId);
    switch (msg.type) {
      case "jobStarted":
        pending?.spawn?.resolve({ logPath: msg.logPath ?? "" });
        if (pending && !pending.output && !pending.kill && !pending.onExit) this.jobPending.delete(msg.jobId);
        else if (pending) pending.spawn = undefined;
        break;
      case "jobError":
        pending?.spawn?.reject(new Error(msg.message ?? "job failed to start"));
        if (pending) pending.spawn = undefined;
        break;
      case "jobOutput":
        pending?.output?.resolve({ output: msg.output ?? "", ...(msg.totalLines !== undefined ? { totalLines: msg.totalLines } : {}), ...(msg.unknown ? { unknown: true } : {}) });
        if (pending) pending.output = undefined;
        if (!pending?.spawn && !pending?.kill && !pending?.onExit) this.jobPending.delete(msg.jobId);
        break;
      case "jobKilled":
        pending?.kill?.resolve({ ...(msg.unknown ? { unknown: true } : {}) });
        if (pending) pending.kill = undefined;
        if (!pending?.spawn && !pending?.output && !pending?.onExit) this.jobPending.delete(msg.jobId);
        break;
      case "jobResult":
        pending?.onExit?.({ code: msg.code ?? null, ...(msg.signal ? { signal: msg.signal } : {}), ...(msg.message ? { message: msg.message } : {}) });
        if (pending && !pending.spawn && !pending.output && !pending.kill) this.jobPending.delete(msg.jobId);
        else if (pending) pending.onExit = undefined;
        break;
    }
  }

  addRunner(conn: RunnerConnection) {
    this.runners.set(conn.runnerId, conn);
    this.notifyChanged();
  }

  /** Owning org of a live runner (metrics ingest routing). */
  orgOf(runnerId: string) {
    return this.runners.get(runnerId)?.organizationId ?? null;
  }

  removeRunner(runnerId: string) {
    this.runners.delete(runnerId);
    this.notifyChanged();
    // Pending job requests can never complete — fail them, and keep exit
    // watchers registered: jobResult may arrive after the runner reconnects
    // only if the job survived, which we can't know. Callers decide (they
    // typically mark such jobs "lost" after a grace period).
    for (const [jobId, pending] of this.jobPending) {
      pending.spawn?.reject(new Error("runner offline"));
      pending.output?.reject(new Error("runner offline"));
      pending.kill?.reject(new Error("runner offline"));
      pending.spawn = undefined;
      pending.output = undefined;
      pending.kill = undefined;
      if (!pending.onExit) this.jobPending.delete(jobId);
    }
    for (const [requestId, pending] of this.awsPending) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error("runner offline"));
      this.awsPending.delete(requestId);
    }
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

  /** Raw server→runner message (metricsConfig etc.) — no-op when offline. */
  sendToRunnerRaw(runnerId: string, msg: unknown) {
    const conn = this.runners.get(runnerId);
    if (conn) send(conn.ws, msg);
  }

  // --- AWS SSO bridge (server is just a router; state lives on the runner) ---

  /** One-shot request over the runner socket with requestId correlation. */
  private awsRequest<T>(runnerId: string, msg: Record<string, unknown>, timeoutMs = 20_000, onCode?: AwsPending["onCode"]): Promise<T> {
    const runner = this.runners.get(runnerId);
    if (!runner) return Promise.reject(new Error("runner offline"));
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const pending: AwsPending = {
        resolve: resolve as (r: unknown) => void,
        reject,
        ...(onCode ? { onCode } : {}),
        timer: setTimeout(() => {
          this.awsPending.delete(requestId);
          reject(new Error("aws request timed out"));
        }, timeoutMs),
      };
      this.awsPending.set(requestId, pending);
      send(runner.ws, { ...msg, requestId });
    });
  }

  async awsStatus(runnerId: string) {
    return this.awsRequest<import("./runner-aws-types").AwsStatus>(runnerId, { type: "awsStatus" }, 15_000);
  }

  /** Device-code login — the code callback fires first; resolves when the
   * token lands on the runner (poll may take minutes; generous timeout). */
  async awsLogin(runnerId: string, startUrl: string | undefined, ssoRegion: string | undefined, onCode: NonNullable<AwsPending["onCode"]>) {
    return this.awsRequest<{ ok: boolean; error?: string }>(runnerId, { type: "awsLogin", startUrl, ssoRegion }, 15 * 60_000, onCode);
  }

  async awsSelect(runnerId: string, profile: string) {
    return this.awsRequest<{ ok: boolean; error?: string }>(runnerId, { type: "awsSelect", profile }, 15_000);
  }

  private handleAwsMessage(msg: {
    type: string;
    requestId?: string;
    status?: unknown;
    ok?: boolean;
    error?: string;
    userCode?: string;
    verificationUri?: string;
    verificationUriComplete?: string | null;
    expiresInSeconds?: number;
  }) {
    if (!msg.requestId) return;
    const pending = this.awsPending.get(msg.requestId);
    if (!pending) return;
    switch (msg.type) {
      case "awsLoginCode":
        pending.onCode?.({
          userCode: msg.userCode ?? "",
          verificationUri: msg.verificationUri ?? "",
          verificationUriComplete: msg.verificationUriComplete ?? null,
          expiresInSeconds: msg.expiresInSeconds ?? 600,
        });
        return; // login still pending
      case "awsStatusResult":
      case "awsLoginResult":
      case "awsSelectResult":
        if (pending.timer) clearTimeout(pending.timer);
        this.awsPending.delete(msg.requestId);
        if (msg.type === "awsStatusResult") pending.resolve(msg.status);
        else if (msg.ok === false && msg.error) pending.reject(new Error(msg.error));
        else pending.resolve({ ok: true });
        return;
    }
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
    if (msg.type.startsWith("aws")) {
      this.handleAwsMessage(msg as Parameters<RunnerManager["handleAwsMessage"]>[0]);
      return;
    }
    if (msg.type.startsWith("job")) {
      this.handleJobMessage(msg as Parameters<RunnerManager["handleJobMessage"]>[0]);
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
