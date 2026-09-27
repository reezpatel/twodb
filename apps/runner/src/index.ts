import os from "node:os";
import { spawn } from "node:child_process";
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
let ws: WebSocket | null = null;
let backoff = 1000;

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
}

function handleExec(execId: string, command: string) {
  const isWin = process.platform === "win32";
  const child = spawn(isWin ? "cmd" : "/bin/sh", isWin ? ["/c", command] : ["-c", command], {
    cwd: os.homedir(),
    env: process.env,
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
      const shell = process.env.SHELL ?? "bash";
      const term = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: msg.cols ?? 80,
        rows: msg.rows ?? 24,
        cwd: os.homedir(),
        env: process.env as Record<string, string>,
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
