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
import { getServerSettings } from "./lib/server-settings";
import { runMigrations } from "./lib/migrate";
import { logger } from "./lib/logger";
import { notesRoutes } from "./routes/notes";
import { notesContentRoutes } from "./routes/notes-content";

const graph = createGraph(env.memgraph.url, env.memgraph.user, env.memgraph.password);

logger.info({ port: env.port, staticDir: env.staticDir ?? null }, "twodb server starting");

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use(
  "/api/*",
  cors({
    origin: [env.webOrigin],
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
registerRunnerWs(app, upgradeWebSocket);
registerCodeWs(app, upgradeWebSocket);
registerChatWs(app, upgradeWebSocket);

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
}

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  logger.info({ port: info.port }, "server listening");
});

injectWebSocket(server);

process.on("SIGINT", async () => {
  logger.info("shutting down (SIGINT)");
  await graph.close();
  await db.destroy();
  process.exit(0);
});
