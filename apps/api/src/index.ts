import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import fastifyEnv from "@fastify/env";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { dbPlugin } from "@twodb/shared-backend";
import { busPlugin, authPlugin } from "@twodb/shared-backend";
import { envSchema, dotenvPath } from "./config";
import postgresPlugin from "./db/postgres";
import memgraphPlugin from "./db/memgraph";
import sqlitePlugin from "./db/sqlite";
import adminRoutes from "./admin/routes";
import { registerServicePlugins } from "./plugins";
import { registerStaticApp } from "./static";

// Plugins are bundled later (loaded via the admin plugin registry instead of
// statically mounted at boot). Until then, no plugin services run here.
// import { service as TwodbIdentiy } from "@twodb/identity/service";
// import { identityAuthPlugin } from "@twodb/identity/service";
// import { identityManifest } from "@twodb/identity/shared/manifest";
// import { service as TwodbContent } from "@twodb/content/service";
// import { contentManifest } from "@twodb/content/shared/manifest";
// import { service as TwodbCalendar } from "@twodb/calendar/service";
// import { calendarManifest } from "@twodb/calendar/shared/manifest";
// import { service as TwodbNode } from "@twodb/node/service";
// import { nodeManifest } from "@twodb/node/shared/manifest";
// import { service as TwodbAgent } from "@twodb/agent/service";
// import { agentManifest } from "@twodb/agent/shared/manifest";
// import { service as TwodbKimiCode } from "@twodb/agent-provider-kimi-code/service";
// import { kimiCodeManifest } from "@twodb/agent-provider-kimi-code/shared/manifest";
// import { service as TwodbCode } from "@twodb/code/service";
// import { codeManifest } from "@twodb/code/shared/manifest";
// import { service as TwodbStorage } from "@twodb/storage/service";
// import { storageManifest } from "@twodb/storage/shared/manifest";
// import { service as TwodbChat } from "@twodb/chat/service";
// import { chatManifest } from "@twodb/chat/shared/manifest";
// import { service as TwodbMeetings } from "@twodb/meetings/service";
// import { meetingsManifest } from "@twodb/meetings/shared/manifest";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

await app.register(fastifyEnv, {
  dotenv: {
    path: path.resolve(import.meta.dirname, dotenvPath),
  },
  schema: envSchema,
});

await app.register(postgresPlugin);
await app.register(memgraphPlugin);
await app.register(sqlitePlugin);
await app.register(dbPlugin);
await app.register(cookie);
await app.register(busPlugin);
await app.register(authPlugin);

// Built plugin bundles from the admin plugin registry (sqlite `plugins`
// table): local:<path> .build dirs load today; git:/npm: sources extract
// into the work dir later. Each service is mounted at /api/v1/<plugin_id>
// and its view bundle is served at /api/v1/<plugin_id>/view/.
await registerServicePlugins(app);

app.get("/api/v1/plugins", async () => {
  return app.loadedPlugins.map((p) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    hasStyles: fs.existsSync(path.join(p.dir, "view", "styles.css")),
  }));
});

// Global session hook: resolves request.principal and 401s /api/v1/* routes
// that are not marked public. Re-enable when plugins are bundled again.
// await app.register(identityAuthPlugin);

// const manifests = [
// 	identityManifest,
// 	contentManifest,
// 	calendarManifest,
// 	nodeManifest,
// 	agentManifest,
// 	kimiCodeManifest,
// 	codeManifest,
// 	chatManifest,
// 	meetingsManifest,
// 	storageManifest,
// ];
// app.decorate("installedPluginManifests", manifests);

// const plugins = [
// 	TwodbIdentiy,
// 	TwodbContent,
// 	TwodbCalendar,
// 	TwodbNode,
// 	TwodbAgent,
// 	TwodbKimiCode,
// 	TwodbCode,
// 	TwodbChat,
// 	TwodbMeetings,
// 	TwodbStorage,
// ];

// for (const plugin of plugins) {
// 	await app.register(plugin.plugin, {
// 		prefix: `/api/v1/${plugin.id}`,
// 	});
// }

// // Core services: the typed backend bus, cookies, the (stub) user context,
// // the identity session hook (401s /api/v1/* without a valid session), and
// // the realtime SSE fan-out at /api/v1/events.
// await app.register(busPlugin);
// await app.register(authPlugin);
// await app.register(identityAuthPlugin);
// await app.register(serviceRegistryPlugin);
// await app.register(realtimePlugin, { prefix: "/api/v1" });

// const claimCatalog = await buildClaimCatalog(manifests);
// app.decorate("claimCatalog", claimCatalog);
// app.decorate("requireClaim", makeRequireClaim(claimCatalog));
// app.decorate("requireAppClaim", makeRequireAppClaim(claimCatalog));
// app.decorate("withWorkspace", makeWithWorkspace(app));
// app.decorate("installedPluginManifests", manifests);

// Service plugins. Boot order is the registry order; a service that declares
// a hard dependency must come after it, which we validate before mounting.
// Each service is mounted under /api/v1/<plugin_id> by the host — services
// never hardcode their own prefix.
// const booted = new Set<string>();
// for (const service of servicePlugins) {
//   for (const dependency of service.dependencies) {
//     if (!booted.has(dependency)) {
//       throw new Error(
//         `Service "${service.pluginId}" depends on "${dependency}", which is not registered before it in apps/api/src/plugins.ts`,
//       );
//     }
//   }
//   await app.register(service, { prefix: `/api/v1/${service.pluginId}` });
//   booted.add(service.pluginId);
// }

app.get("/health", async () => {
  return { status: "ok" };
});

// Admin api (feature surface TBD) - backed by the api-owned sqlite db.
await app.register(adminRoutes, { prefix: "/api/admin" });

// src/db/postgres.ts attaches `ping` to the existing `fastify.pg` decorator
// at runtime; @fastify/postgres's types don't know about it.
type PgWithPing = typeof app.pg & { ping: () => Promise<unknown> };

// Deep health check: pings each database so a single endpoint can tell you
// whether the api is merely up or whether both backends are reachable.
app.get("/health/ready", async (_request, reply) => {
  const checks = {
    postgres: "unknown",
    memgraph: "unknown",
    sqlite: "unknown",
  };

  try {
    await (app.pg as PgWithPing).ping();
    checks.postgres = "ok";
  } catch (err) {
    checks.postgres = `down: ${err instanceof Error ? err.message : err}`;
  }

  try {
    await app.memgraph.ping();
    checks.memgraph = "ok";
  } catch (err) {
    checks.memgraph = `down: ${err instanceof Error ? err.message : err}`;
  }

  try {
    await app.sqlite.ping();
    checks.sqlite = "ok";
  } catch (err) {
    checks.sqlite = `down: ${err instanceof Error ? err.message : err}`;
  }

  const allOk = checks.postgres === "ok" && checks.memgraph === "ok" && checks.sqlite === "ok";
  reply.code(allOk ? 200 : 503);
  return { status: allOk ? "ready" : "degraded", checks };
});

await registerStaticApp(app);

const port = app.config.PORT;

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
