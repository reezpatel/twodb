import os from "node:os";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import * as pty from "node-pty";
import WebSocket from "ws";
import { RunnerCore, collectMetrics, awsStatus, awsLogin, awsSelectProfile, type ServerMessage } from "@twodb/runner-core";
import { TeamsManager } from "./teams/manager";

const serverUrl = process.env.TWODB_SERVER_URL ?? "http://localhost:3001";
const key = process.env.TWODB_RUNNER_KEY;
const name = process.env.TWODB_RUNNER_NAME ?? os.hostname();
const port = Number(process.env.RUNNER_PORT ?? 4700);
/** Comma-separated extra mount points to watch (server config overrides). */
const diskPathsEnv = (process.env.TWODB_RUNNER_DISKS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!key) {
  console.error("TWODB_RUNNER_KEY is required");
  process.exit(1);
}

let ws: WebSocket | null = null;
let backoff = 1000;
/** Disk paths pushed by the server (from the per-runner UI config). */
let diskPaths: string[] = diskPathsEnv;

// --- keepalive watchdog -------------------------------------------------------
// Ping every 5s; a missed pong means the connection is half-open (NAT timeout,
// silent network drop) — terminate immediately and let the reconnect logic
// (exponential backoff) re-establish. The server replies {type:"pong"}.
const PING_INTERVAL = 5_000;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let gotPong = false;

function startPinging() {
  if (pingTimer) return;
  gotPong = true; // open just happened; first ping hasn't flown yet
  pingTimer = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!gotPong) {
      console.log("keepalive: no pong — terminating connection");
      ws.terminate();
      return;
    }
    gotPong = false;
    send({ type: "ping" });
  }, PING_INTERVAL);
}

function stopPinging() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
}

const core = new RunnerCore({
  send: (msg) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  },
  ptySpawn: (file, args, opts) => pty.spawn(file, args as string[], opts as Parameters<typeof pty.spawn>[2]) as unknown as import("@twodb/runner-core").PtyProcess,
});

const teams = new TeamsManager((msg) => send(msg));

function send(msg: unknown) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function handle(msg: ServerMessage) {
  switch (msg.type) {
    case "welcome":
      console.log(`registered as runner ${msg.runnerId}`);
      break;
    case "pong":
      gotPong = true;
      break;
    case "metricsConfig":
      // Server-side disk-path config (Settings → Runners) overrides the env var.
      if (Array.isArray(msg.diskPaths)) diskPaths = msg.diskPaths.map(String);
      break;
    case "awsStatus":
      void awsStatus().then((status) => send({ type: "awsStatusResult", requestId: msg.requestId, status }));
      break;
    case "awsLogin":
      // Device-code login: the code goes to the UI immediately, completion later.
      void awsLogin({ startUrl: msg.startUrl, ssoRegion: msg.ssoRegion }, (start) => {
        send({ type: "awsLoginCode", requestId: msg.requestId, userCode: start.userCode, verificationUri: start.verificationUri, verificationUriComplete: start.verificationUriComplete, expiresInSeconds: start.expiresInSeconds });
      }, (ok, error) => {
        send({ type: "awsLoginResult", requestId: msg.requestId, ok, ...(error ? { error } : {}) });
      });
      break;
    case "awsSelect":
      void awsSelectProfile(msg.profile ?? "").then((r) => send({ type: "awsSelectResult", requestId: msg.requestId, ...r }));
      break;
    case "teamsStart":
    case "teamsStop":
    case "teamsLiveStart":
    case "teamsLiveStop":
    case "teamsLiveInput":
      void teams.handle(msg);
      break;
    default:
      core.handle(msg);
  }
}

// Metrics every 10s — the server persists a sample per 10-minute window and
// fans the live values out to subscribed clients.
let metricsTimer: ReturnType<typeof setInterval> | null = null;
function startMetrics() {
  if (metricsTimer) return;
  const tick = () => collectMetrics(diskPaths, (m) => send({ type: "metrics", runnerName: name, metrics: m }));
  tick();
  metricsTimer = setInterval(tick, 10_000);
}
function stopMetrics() {
  if (metricsTimer) clearInterval(metricsTimer);
  metricsTimer = null;
}

function connect() {
  const url = `${serverUrl.replace(/^http/, "ws")}/api/runners/connect?key=${encodeURIComponent(key!)}&name=${encodeURIComponent(name)}&hostname=${encodeURIComponent(os.hostname())}`;
  ws = new WebSocket(url);

  ws.on("open", () => {
    backoff = 1000;
    console.log(`connected to ${serverUrl} as "${name}"`);
    startMetrics();
    startPinging();
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
    core.cleanupTerminals();
    core.stampJobsShutdown();
    stopMetrics();
    stopPinging();
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
