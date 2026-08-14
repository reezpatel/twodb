import path from "node:path";
import Fastify from "fastify";
import fastifyEnv from "@fastify/env";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import {
	busPlugin,
	authPlugin,
	dbPlugin,
	realtimePlugin,
	serviceRegistryPlugin,
} from "@twodb/shared-backend";
import { identityAuthPlugin } from "@twodb/plugin-identity/auth";
import { envSchema, dotenvPath } from "./config.js";
import postgresPlugin from "./db/postgres.js";
import memgraphPlugin from "./db/memgraph.js";
import { servicePlugins } from "./plugins.js";
import { registerStaticApp } from "./static.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Register @fastify/env first so every subsequent plugin/handler can read
// `fastify.config.*`. The schema in src/config.js defines every env var the
// api consumes, along with defaults - so the api boots with sensible
// dev defaults even when no .env is present. Plugin options still win.
await app.register(fastifyEnv, {
	// Resolve the .env path relative to this file so it works regardless of
	// the working directory the api was launched from (apps/api, repo root,
	// turbo, etc.). dotenv silently no-ops if the file is missing.
	dotenv: {
		path: path.resolve(import.meta.dirname, dotenvPath),
	},
	schema: envSchema,
});

// Wire up data sources. Both plugins fail fast at boot if their DB is
// unreachable, so the api will not start in a half-broken state.
await app.register(postgresPlugin);
await app.register(memgraphPlugin);
await app.register(dbPlugin);

// Core services: the typed backend bus, cookies, the (stub) user context,
// the identity session hook (401s /api/v1/* without a valid session), and
// the realtime SSE fan-out at /api/v1/events.
await app.register(busPlugin);
await app.register(cookie);
await app.register(authPlugin);
await app.register(identityAuthPlugin);
await app.register(serviceRegistryPlugin);
await app.register(realtimePlugin, { prefix: "/api/v1" });

// Service plugins. Boot order is the registry order; a service that declares
// a hard dependency must come after it, which we validate before mounting.
// Each service is mounted under /api/v1/<plugin_id> by the host — services
// never hardcode their own prefix.
const booted = new Set<string>();
for (const service of servicePlugins) {
	for (const dependency of service.dependencies) {
		if (!booted.has(dependency)) {
			throw new Error(
				`Service "${service.pluginId}" depends on "${dependency}", which is not registered before it in apps/api/src/plugins.ts`,
			);
		}
	}
	await app.register(service, { prefix: `/api/v1/${service.pluginId}` });
	booted.add(service.pluginId);
}

app.get("/health", async () => {
	return { status: "ok" };
});

// src/db/postgres.js attaches `ping` to the existing `fastify.pg` decorator
// at runtime; @fastify/postgres's types don't know about it.
type PgWithPing = typeof app.pg & { ping: () => Promise<unknown> };

// Deep health check: pings each database so a single endpoint can tell you
// whether the api is merely up or whether both backends are reachable.
app.get("/health/ready", async (_request, reply) => {
	const checks = { postgres: "unknown", memgraph: "unknown" };

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

	const allOk = checks.postgres === "ok" && checks.memgraph === "ok";
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
