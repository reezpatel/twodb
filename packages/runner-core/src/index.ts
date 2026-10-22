import os from "node:os";
import fs from "node:fs";
import { dirname } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { awsEnv } from "./aws";

export * from "./metrics";
export * from "./aws";

/**
 * Runner core: everything the standalone runner process does that the main
 * app's embedded runner also needs — environment building, exec, background
 * jobs, terminal management — minus the transport. Callers pass a `send`
 * (websocket or in-process channel) and wire messages to `handle`.
 */

/** Structural view of a node-pty process — keeps runner-core dependency-free. */
export interface PtyProcess {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (e: { exitCode: number }) => void): void;
}

/** node-pty's spawn, structurally — pass the real thing from the runner. */
export type PtySpawn = (
  file: string,
  args: string[] | string,
  opts: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> },
) => PtyProcess;

export interface ServerMessage {
  type: string;
  sessionId: string;
  runnerId?: string;
  execId?: string;
  command?: string;
  cols?: number;
  rows?: number;
  data?: string;
  cwd?: string;
  tmuxName?: string;
  jobId?: string;
  lines?: number;
  diskPaths?: string[];
  /** AWS bridge (request/reply with requestId). */
  requestId?: string;
  startUrl?: string;
  ssoRegion?: string;
  profile?: string;
}

export interface RunnerCoreOptions {
  /** Transport for runner→server messages (ws.send or in-process). */
  send: (msg: unknown) => void;
  /** node-pty spawn — null when the host runs without pty support. */
  ptySpawn: PtySpawn | null;
}

// systemd units get a minimal PATH (/usr/bin:/bin) that on NixOS lacks node,
// git and coreutils — widen it so execs and terminals can resolve tools.
// Nix user profiles (system packages, `nix profile`, home-manager) only enter
// PATH via profile files, which non-login exec shells never source — so the
// standard locations are listed explicitly.
export function spawnEnv(): Record<string, string> {
  const home = os.homedir();
  const user = process.env.USER || (() => { try { return os.userInfo().username; } catch { return "user"; } })();
  const path = [
    dirname(process.execPath),
    "/run/current-system/sw/bin",
    `/etc/profiles/per-user/${user}/bin`,
    `${home}/.nix-profile/bin`,
    `${home}/.local/state/nix/profiles/home-manager/home-path/bin`,
    "/usr/local/bin",
    "/opt/homebrew/bin",
    process.env.PATH ?? "",
  ]
    .filter(Boolean)
    .join(":");
  // The selected AWS SSO profile (if any) applies to every spawn — execs,
  // jobs, terminals — so the widget's choice is what the agent uses too.
  return { ...process.env, PATH: path, ...awsEnv() } as Record<string, string>;
}

// tmux gives terminals persistence: closing a tab detaches instead of killing
// the session, and reopening reattaches where you left off.
export const hasTmux = process.platform !== "win32" && spawnSync("tmux", ["-V"], { stdio: "ignore" }).status === 0;

export class RunnerCore {
  private send: (msg: unknown) => void;
  private ptySpawn: PtySpawn | null;
  private terms = new Map<string, PtyProcess>();

  // Background jobs: detached processes whose output lands in a log file. The
  // server tracks them by jobId and asks for tail lines on demand — the runner
  // stays the source of truth for the process itself.
  private jobs = new Map<string, { child: ReturnType<typeof spawn>; logPath: string; command: string; startedAt: number }>();

  constructor(opts: RunnerCoreOptions) {
    this.send = opts.send;
    this.ptySpawn = opts.ptySpawn;
  }

  jobsDir() {
    return `${os.tmpdir()}/twodb-jobs`;
  }

  private handleSpawnJob(jobId: string, command: string, cwd?: string) {
    try {
      fs.mkdirSync(this.jobsDir(), { recursive: true });
      const logPath = `${this.jobsDir()}/${jobId}.log`;
      const workDir = cwd && fs.existsSync(cwd) ? cwd : os.homedir();
      const out = fs.openSync(logPath, "a");
      // setsid detaches: the job survives its parent and never blocks the runner.
      const child = spawn("/bin/sh", ["-c", command], {
        cwd: workDir,
        env: spawnEnv(),
        detached: process.platform !== "win32",
        stdio: ["ignore", out, out],
      });
      child.on("error", (error) => {
        fs.appendFileSync(logPath, `\n[twodb] failed to start: ${error.message}\n`);
        this.send({ type: "jobResult", jobId, code: null, message: error.message });
      });
      child.on("close", (code, signal) => {
        try {
          fs.closeSync(out);
        } catch {
          // already closed
        }
        // signal set = killed externally (panel kill, runner shutdown) — the
        // server maps that to "killed" instead of misreading 128+n as an error.
        this.send({ type: "jobResult", jobId, code, ...(signal ? { signal } : {}) });
      });
      this.jobs.set(jobId, { child, logPath, command, startedAt: Date.now() });
      this.send({ type: "jobStarted", jobId, logPath });
    } catch (e) {
      this.send({ type: "jobError", jobId, message: (e as Error).message });
    }
  }

  private tailFile(logPath: string, lines: number): string {
    try {
      const content = fs.readFileSync(logPath, "utf8");
      const rows = content.length ? content.replace(/\n$/, "").split("\n") : [];
      const start = Math.max(0, rows.length - lines);
      return rows.slice(start).join("\n");
    } catch {
      return "";
    }
  }

  private handleJobOutput(jobId: string, lines: number) {
    const job = this.jobs.get(jobId);
    if (!job) return this.send({ type: "jobOutput", jobId, output: "", unknown: true });
    this.send({ type: "jobOutput", jobId, output: this.tailFile(job.logPath, Math.max(1, lines)) });
  }

  /** Mark tracked jobs in the log so a restarted server can distinguish a
   * finished job (clean exit marker) from a lost one. */
  stampJobsShutdown() {
    for (const [jobId, job] of this.jobs) {
      try {
        fs.appendFileSync(job.logPath, `\n[twodb-job ${jobId}] runner disconnected before job exit was observed\n`);
      } catch {
        // log already gone
      }
    }
  }

  private handleJobKill(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return this.send({ type: "jobKilled", jobId, unknown: true });
    try {
      // Negative pid = the whole detached process group.
      if (job.child.pid) process.kill(-job.child.pid, "SIGTERM");
      else job.child.kill("SIGTERM");
    } catch {
      // already gone — treat as killed
    }
    this.send({ type: "jobKilled", jobId });
  }

  private handleExec(execId: string, command: string) {
    const isWin = process.platform === "win32";
    const child = spawn(isWin ? "cmd" : "/bin/sh", isWin ? ["/c", command] : ["-c", command], {
      cwd: os.homedir(),
      env: spawnEnv(),
    });

    const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
    const pipe = (stream: NodeJS.ReadableStream | null, name: "stdout" | "stderr") => {
      if (!stream) return;
      stream.setEncoding("utf8");
      stream.on("data", (data: string) => this.send({ type: "execChunk", execId, stream: name, data }));
    };
    pipe(child.stdout, "stdout");
    pipe(child.stderr, "stderr");

    child.on("error", (error) => {
      clearTimeout(timer);
      this.send({ type: "execResult", execId, message: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      this.send({ type: "execResult", execId, code: code ?? 0 });
    });
  }

  private openTerminal(msg: ServerMessage) {
    if (!this.ptySpawn) return this.send({ type: "error", sessionId: msg.sessionId, message: "pty unavailable" });
    const cwd = msg.cwd && fs.existsSync(msg.cwd) ? msg.cwd : os.homedir();
    const tmux = hasTmux && typeof msg.tmuxName === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(msg.tmuxName);
    // login shell: profile files re-establish PATH inside the pane, which matters
    // when the tmux server predates the runner and dropped its environment
    const shell =
      (process.env.SHELL && fs.existsSync(process.env.SHELL) && process.env.SHELL) || (fs.existsSync("/bin/bash") && "/bin/bash") || "/bin/sh";
    const term = this.ptySpawn(
      tmux ? "tmux" : shell,
      tmux ? ["new-session", "-A", "-s", msg.tmuxName!, "-c", cwd, `${shell} -l`] : ["-l"],
      {
        name: "xterm-256color",
        cols: msg.cols ?? 80,
        rows: msg.rows ?? 24,
        cwd,
        env: spawnEnv(),
      },
    );
    this.terms.set(msg.sessionId, term);
    term.onData((data) => this.send({ type: "output", sessionId: msg.sessionId, data }));
    term.onExit(({ exitCode }) => {
      this.send({ type: "exit", sessionId: msg.sessionId, code: exitCode });
      this.terms.delete(msg.sessionId);
    });
  }

  /** Server→runner message dispatch. Returns nothing; replies ride `send`. */
  handle(msg: ServerMessage) {
    switch (msg.type) {
      case "open":
        this.openTerminal(msg);
        break;
      case "input":
        this.terms.get(msg.sessionId)?.write(msg.data ?? "");
        break;
      case "resize":
        if (msg.cols && msg.rows) this.terms.get(msg.sessionId)?.resize(msg.cols, msg.rows);
        break;
      case "close":
        this.terms.get(msg.sessionId)?.kill();
        this.terms.delete(msg.sessionId);
        break;
      case "exec":
        if (msg.execId && msg.command) this.handleExec(msg.execId, msg.command);
        break;
      case "spawnJob":
        if (msg.jobId && msg.command) this.handleSpawnJob(msg.jobId, msg.command, msg.cwd);
        break;
      case "jobOutput":
        if (msg.jobId) this.handleJobOutput(msg.jobId, msg.lines ?? 10);
        break;
      case "jobKill":
        if (msg.jobId) this.handleJobKill(msg.jobId);
        break;
    }
  }

  /** Kill all terminals (disconnect path). */
  cleanupTerminals() {
    for (const term of this.terms.values()) term.kill();
    this.terms.clear();
  }
}
