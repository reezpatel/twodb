import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { relative } from "node:path";
import { env } from "./env";
import { createGraph } from "./plugins/memgraph";
import { auth, db } from "./auth";
import { llmRoutes } from "./routes/llm";
import { codeRoutes } from "./routes/code";
import { skillRoutes } from "./routes/skills";
import { memoryRoutes } from "./routes/memories";
import { agentRoutes } from "./routes/agents";
import { instructionRoutes } from "./routes/instructions";
import { llmTagRoutes } from "./routes/llm-tags";
import { footerPreferenceRoutes } from "./routes/footer-preferences";
import { mcpRoutes } from "./routes/mcp";
import { runnerRoutes } from "./routes/runners";
import { registerRunnerWs } from "./routes/runner-ws";
import { registerCodeWs } from "./routes/code-ws";
import { registerChatWs } from "./routes/chat-ws";
import { chatRoutes } from "./routes/chat";
import { storageRoutes } from "./routes/storage";
import { storageAdminRoutes } from "./routes/storage-admin";
import { serverSettingsRoutes } from "./routes/server-settings";
import { apiKeyRoutes } from "./routes/api-keys";
import { logsRoutes } from "./routes/logs";
import { meetingsRoutes } from "./routes/meetings";
import { emailRoutes } from "./routes/email";
import { registerEmailWs } from "./routes/email-ws";
import { startEmailScheduler, stopEmailScheduler } from "./lib/email/scheduler";
import { calendarRoutes } from "./routes/calendar";
import { registerCalendarWs } from "./routes/calendar-ws";
import { contactRoutes } from "./routes/contacts";
import { startCalendarScheduler, stopCalendarScheduler } from "./lib/calendar/scheduler";
import "./lib/calendar/imip";
import { getServerSettings } from "./lib/server-settings";
import { runMigrations } from "./lib/migrate";
import { reconcileOrphanJobs } from "./lib/background-jobs";
import { logger } from "./lib/logger";
import { notesRoutes } from "./routes/notes";
import { notesContentRoutes } from "./routes/notes-content";
import { spaceRoutes } from "./routes/spaces";

const graph = createGraph(env.memgraph.url, env.memgraph.user, env.memgraph.password);

logger.info({ port: env.port, staticDir: env.staticDir ?? null }, "twodb server starting");

const app = new Hono();

const { injectWebSocket, upgradeWebSocket, wss } = createNodeWebSocket({ app });

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (!origin) return env.auth.origin;
      if (origin === env.auth.origin || origin.startsWith("chrome-extension://")) return origin;
      return null;
    },
    credentials: true,
  }),
);

app.get("/api/health", async (c) => {
  const checks: Record<string, boolean> = {};

  try {
    await db.selectFrom("user").select("id").limit(1).execute();
    checks.postgres = true;
  } catch (e) {
    checks.postgres = false;
    logger.error({ err: e }, "health check: postgres unreachable");
  }

  try {
    await graph.verifyConnectivity();
    checks.memgraph = true;
  } catch (e) {
    checks.memgraph = false;
    logger.error({ err: e }, "health check: memgraph unreachable");
  }

  return c.json({ ok: Object.values(checks).every(Boolean), checks });
});

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/llm", llmRoutes);
app.route("/api/code", codeRoutes);
app.route("/api/skills", skillRoutes);
app.route("/api/memories", memoryRoutes);
app.route("/api/mcp", mcpRoutes);
app.route("/api/agents", agentRoutes);
app.route("/api/instructions", instructionRoutes);
app.route("/api/llm-tags", llmTagRoutes);
app.route("/api/footer-preferences", footerPreferenceRoutes);
app.route("/api", runnerRoutes);
app.route("/api/storage", storageRoutes);
app.route("/api/storage-backends", storageAdminRoutes);
app.route("/api/notes", notesRoutes);
app.route("/api/notes", notesContentRoutes);
app.route("/api/server-settings", serverSettingsRoutes);
app.route("/api/api-keys", apiKeyRoutes);
app.route("/api/logs", logsRoutes);

// Public subset (register page reads this before showing the form).
app.get("/api/public-settings", async (c) => c.json(await getServerSettings()));
app.route("/api/chat", chatRoutes);
app.route("/api/meetings", meetingsRoutes);
app.route("/api/email", emailRoutes);
app.route("/api/calendar", calendarRoutes);
app.route("/api/contacts", contactRoutes);
app.route("/api/spaces", spaceRoutes);
registerRunnerWs(app, upgradeWebSocket);
registerCodeWs(app, upgradeWebSocket);
registerChatWs(app, upgradeWebSocket);
registerEmailWs(app, upgradeWebSocket);
registerCalendarWs(app, upgradeWebSocket);

// Production: serve the built desktop app (SPA) from a static dir; API routes
// above always win because they are registered first.
if (env.staticDir) {
  const webRoot = relative(process.cwd(), env.staticDir);
  app.use("*", serveStatic({ root: webRoot }));
  app.get("*", serveStatic({ root: webRoot, path: "index.html" }));
}

if (env.skipAutoMigration) {
  logger.warn("TWO_DB_SKIP_AUTO_MIGRATION set — skipping database migrations");
} else {
  try {
    await runMigrations(db);
  } catch (error) {
    logger.error({ err: error }, "database migration failed");
    process.exit(1);
  }
  // Background jobs that were running when this server last stopped have no
  // watcher anymore — mark old ones lost (fresh ones get the grace period).
  try {
    await reconcileOrphanJobs();
  } catch (err) {
    logger.warn({ err }, "background job reconcile failed (non-fatal)");
  }
}

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  logger.info({ port: info.port }, "server listening");
  // Embedded runner: this machine registers as a runner (no key, in-process).
  // Self-hosted deployments are typically single-org — the local runner binds
  // to the first org at boot. (Multi-org hosts can disable it via env.)
  if (process.env.TWODB_LOCAL_RUNNER !== "off") {
    void (async () => {
      try {
        const { startLocalRunner, touchLocalRunner } = await import("./lib/local-runner");
        const org = await db.selectFrom("organization").select("id").orderBy("createdAt", "asc").executeTakeFirst();
        if (org) {
          await startLocalRunner(org.id);
          setInterval(() => touchLocalRunner(), 60_000).unref();
        }
      } catch (err) {
        logger.warn({ err }, "local runner failed to start (non-fatal)");
      }
    })();
  }
});

injectWebSocket(server);

// Keepalive: proxies (nginx) drop idle sockets after ~60s. Ping every 30s and
// terminate peers that missed the last pong (half-open TCP after network loss).
const aliveSockets = new WeakSet<object>();
wss.on("connection", (socket) => {
  aliveSockets.add(socket);
  socket.on("pong", () => aliveSockets.add(socket));
});
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!aliveSockets.has(socket)) {
      socket.terminate();
      continue;
    }
    aliveSockets.delete(socket);
    socket.ping();
  }
}, 30_000);
heartbeat.unref();

startEmailScheduler();
startCalendarScheduler();

process.on("SIGINT", async () => {
  logger.info("shutting down (SIGINT)");
  clearInterval(heartbeat);
  stopEmailScheduler();
  stopCalendarScheduler();
  await graph.close();
  await db.destroy();
  process.exit(0);
});
