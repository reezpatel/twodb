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
import { runnerRoutes } from "./routes/runners";
import { registerRunnerWs } from "./routes/runner-ws";
import { registerCodeWs } from "./routes/code-ws";
import { storageRoutes } from "./routes/storage";
import { storageAdminRoutes } from "./routes/storage-admin";
import { serverSettingsRoutes } from "./routes/server-settings";
import { apiKeyRoutes } from "./routes/api-keys";
import { getServerSettings } from "./lib/server-settings";
import { runMigrations } from "./lib/migrate";
import { notesRoutes } from "./routes/notes";
import { notesContentRoutes } from "./routes/notes-content";

const graph = createGraph(env.memgraph.url, env.memgraph.user, env.memgraph.password);

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
  } catch {
    checks.postgres = false;
  }

  try {
    await graph.verifyConnectivity();
    checks.memgraph = true;
  } catch {
    checks.memgraph = false;
  }

  return c.json({ ok: Object.values(checks).every(Boolean), checks });
});

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/llm", llmRoutes);
app.route("/api/code", codeRoutes);
app.route("/api/skills", skillRoutes);
app.route("/api/memories", memoryRoutes);
app.route("/api/agents", agentRoutes);
app.route("/api/instructions", instructionRoutes);
app.route("/api/llm-tags", llmTagRoutes);
app.route("/api", runnerRoutes);
app.route("/api/storage", storageRoutes);
app.route("/api/storage-backends", storageAdminRoutes);
app.route("/api/notes", notesRoutes);
app.route("/api/notes", notesContentRoutes);
app.route("/api/server-settings", serverSettingsRoutes);
app.route("/api/api-keys", apiKeyRoutes);

// Public subset (register page reads this before showing the form).
app.get("/api/public-settings", async (c) => c.json(await getServerSettings()));
registerRunnerWs(app, upgradeWebSocket);
registerCodeWs(app, upgradeWebSocket);

// Production: serve the built desktop app (SPA) from a static dir; API routes
// above always win because they are registered first.
if (env.staticDir) {
  const webRoot = relative(process.cwd(), env.staticDir);
  app.use("*", serveStatic({ root: webRoot }));
  app.get("*", serveStatic({ root: webRoot, path: "index.html" }));
}

if (env.skipAutoMigration) {
  console.log("TWO_DB_SKIP_AUTO_MIGRATION set — skipping database migrations");
} else {
  try {
    await runMigrations(db);
  } catch (error) {
    console.error("database migration failed:", error);
    process.exit(1);
  }
}

const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`);
});

injectWebSocket(server);

process.on("SIGINT", async () => {
  await graph.close();
  await db.destroy();
  process.exit(0);
});
