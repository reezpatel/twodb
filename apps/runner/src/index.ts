import os from "node:os";
import fs from "node:fs";
import { dirname } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import * as pty from "node-pty";
import WebSocket from "ws";

const serverUrl = process.env.TWODB_SERVER_URL ?? "http://localhost:3001";
const key = process.env.TWODB_RUNNER_KEY;
const name = process.env.TWODB_RUNNER_NAME ?? os.hostname();
const port = Number(process.env.RUNNER_PORT ?? 4700);

if (!key) {
  console.error("TWODB_RUNNER_KEY is required");
  process.exit(1);
}

const terms = new Map<string, pty.IPty>();

// systemd units get a minimal PATH (/usr/bin:/bin) that on NixOS lacks node,
// git and coreutils — widen it so execs and terminals can resolve tools.
// Nix user profiles (system packages, `nix profile`, home-manager) only enter
// PATH via profile files, which non-login exec shells never source — so the
// standard locations are listed explicitly.
function spawnEnv(): Record<string, string> {
  const home = os.homedir();
  const user = process.env.USER || os.userInfo().username;
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
  return { ...process.env, PATH: path } as Record<string, string>;
}
let ws: WebSocket | null = null;
let backoff = 1000;

// tmux gives terminals persistence: closing a tab detaches instead of killing
// the session, and reopening reattaches where you left off.
const hasTmux = process.platform !== "win32" && spawnSync("tmux", ["-V"], { stdio: "ignore" }).status === 0;

function send(msg: unknown) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

interface ServerMessage {
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
}

// Background jobs: detached processes whose output lands in a log file. The
// server tracks them by jobId and asks for tail lines on demand — the runner
// stays the source of truth for the process itself.
const jobs = new Map<string, { child: ReturnType<typeof spawn>; logPath: string; command: string; startedAt: number }>();
const JOBS_DIR = () => `${os.tmpdir()}/twodb-jobs`;

function handleSpawnJob(jobId: string, command: string, cwd?: string) {
  try {
    fs.mkdirSync(JOBS_DIR(), { recursive: true });
    const logPath = `${JOBS_DIR()}/${jobId}.log`;
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
      send({ type: "jobResult", jobId, code: null, message: error.message });
    });
    child.on("close", (code, signal) => {
      try {
        fs.closeSync(out);
      } catch {
        // already closed
      }
      // signal set = killed externally (panel kill, runner shutdown) — the
      // server maps that to "killed" instead of misreading 128+n as an error.
      send({ type: "jobResult", jobId, code, ...(signal ? { signal } : {}) });
    });
    jobs.set(jobId, { child, logPath, command, startedAt: Date.now() });
    send({ type: "jobStarted", jobId, logPath });
  } catch (e) {
    send({ type: "jobError", jobId, message: (e as Error).message });
  }
}

function tailFile(logPath: string, lines: number): string {
  try {
    const content = fs.readFileSync(logPath, "utf8");
    const rows = content.length ? content.replace(/\n$/, "").split("\n") : [];
    const start = Math.max(0, rows.length - lines);
    return rows.slice(start).join("\n");
  } catch {
    return "";
  }
}

function handleJobOutput(jobId: string, lines: number) {
  const job = jobs.get(jobId);
  if (!job) return send({ type: "jobOutput", jobId, output: "", unknown: true });
  send({ type: "jobOutput", jobId, output: tailFile(job.logPath, Math.max(1, lines)) });
}

/** On disconnect, mark tracked jobs in the log so the server can distinguish a
 * finished job (has exit marker) from a lost one (log ends without it). */
/** Mark tracked jobs in the log so a restarted server can distinguish a
 * finished job (clean exit marker) from a lost one. */
function stampJobsShutdown() {
  for (const [jobId, job] of jobs) {
    try {
      fs.appendFileSync(job.logPath, `\n[twodb-job ${jobId}] runner disconnected before job exit was observed\n`);
    } catch {
      // log already gone
    }
  }
}

function handleJobKill(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return send({ type: "jobKilled", jobId, unknown: true });
  try {
    // Negative pid = the whole detached process group.
    if (job.child.pid) process.kill(-job.child.pid, "SIGTERM");
    else job.child.kill("SIGTERM");
  } catch {
    // already gone — treat as killed
  }
  send({ type: "jobKilled", jobId });
}


function handleExec(execId: string, command: string) {
  const isWin = process.platform === "win32";
  const child = spawn(isWin ? "cmd" : "/bin/sh", isWin ? ["/c", command] : ["-c", command], {
    cwd: os.homedir(),
    env: spawnEnv(),
  });

  const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
  const pipe = (stream: NodeJS.ReadableStream | null, name: "stdout" | "stderr") => {
    if (!stream) return;
    stream.setEncoding("utf8");
    stream.on("data", (data: string) => send({ type: "execChunk", execId, stream: name, data }));
  };
  pipe(child.stdout, "stdout");
  pipe(child.stderr, "stderr");

  child.on("error", (error) => {
    clearTimeout(timer);
    send({ type: "execResult", execId, message: error.message });
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    send({ type: "execResult", execId, code: code ?? 0 });
  });
}

function handle(msg: ServerMessage) {
  switch (msg.type) {
    case "welcome":
      console.log(`registered as runner ${msg.runnerId}`);
      break;
    case "open": {
      const cwd = msg.cwd && fs.existsSync(msg.cwd) ? msg.cwd : os.homedir();
      const tmux = hasTmux && typeof msg.tmuxName === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(msg.tmuxName);
      // login shell: profile files re-establish PATH inside the pane, which matters
      // when the tmux server predates the runner and dropped its environment
      const shell = (process.env.SHELL && fs.existsSync(process.env.SHELL) && process.env.SHELL) || (fs.existsSync("/bin/bash") && "/bin/bash") || "/bin/sh";
      const term = pty.spawn(tmux ? "tmux" : shell, tmux ? ["new-session", "-A", "-s", msg.tmuxName!, "-c", cwd, `${shell} -l`] : ["-l"], {
        name: "xterm-256color",
        cols: msg.cols ?? 80,
        rows: msg.rows ?? 24,
        cwd,
        env: spawnEnv(),
      });
      terms.set(msg.sessionId, term);
      term.onData((data) => send({ type: "output", sessionId: msg.sessionId, data }));
      term.onExit(({ exitCode }) => {
        send({ type: "exit", sessionId: msg.sessionId, code: exitCode });
        terms.delete(msg.sessionId);
      });
      break;
    }
    case "input":
      terms.get(msg.sessionId)?.write(msg.data ?? "");
      break;
    case "resize":
      if (msg.cols && msg.rows) terms.get(msg.sessionId)?.resize(msg.cols, msg.rows);
      break;
    case "close":
      terms.get(msg.sessionId)?.kill();
      terms.delete(msg.sessionId);
      break;
    case "exec":
      if (msg.execId && msg.command) handleExec(msg.execId, msg.command);
      break;
    case "spawnJob":
      if (msg.jobId && msg.command) handleSpawnJob(msg.jobId, msg.command, msg.cwd);
      break;
    case "jobOutput":
      if (msg.jobId) handleJobOutput(msg.jobId, msg.lines ?? 10);
      break;
    case "jobKill":
      if (msg.jobId) handleJobKill(msg.jobId);
      break;
  }
}

function cleanupTerminals() {
  for (const term of terms.values()) term.kill();
  terms.clear();
}

function connect() {
  const url = `${serverUrl.replace(/^http/, "ws")}/api/runners/connect?key=${encodeURIComponent(key!)}&name=${encodeURIComponent(name)}&hostname=${encodeURIComponent(os.hostname())}`;
  ws = new WebSocket(url);

  ws.on("open", () => {
    backoff = 1000;
    console.log(`connected to ${serverUrl} as "${name}"`);
  });

  ws.on("message", (raw) => {
    try {
      handle(JSON.parse(raw.toString()) as ServerMessage);
    } catch {
      // ignore malformed frames
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`disconnected (${code} ${reason})`);
    cleanupTerminals();
    stampJobsShutdown();
    jobs.clear();
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 30_000);
  });

  ws.on("error", () => {
    // close event follows and handles reconnect
  });
}

connect();

const app = new Hono();
app.get("/health", (c) => c.json({ ok: true, name, connected: ws?.readyState === WebSocket.OPEN }));

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`runner health on http://localhost:${info.port}`);
});
