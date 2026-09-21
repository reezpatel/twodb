import path from "node:path";
import Fastify from "fastify";
import fastifyEnv from "@fastify/env";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { envSchema, dotenvPath } from "./config";
import postgresPlugin from "./db/postgres";
import { registerStaticApp } from "./static";
import { adminPlugin } from "./admin";

const app = Fastify({ logger: true });
await app.register(fastifyEnv, {
  dotenv: { path: path.resolve(import.meta.dirname, dotenvPath) },
  schema: envSchema,
});
await app.register(cors, { origin: true });
await app.register(postgresPlugin);
await app.register(cookie);

await app.register(adminPlugin);

app.get("/health/ready", async (_request, reply) => {
  const checks = {
    postgres: "unknown",
  };

  try {
    checks.postgres = "ok";
  } catch (err) {
    checks.postgres = `down: ${err instanceof Error ? err.message : err}`;
  }

  const allOk = checks.postgres === "ok";
  reply.code(allOk ? 200 : 503);
  return { status: allOk ? "ready" : "degraded", checks };
});

await registerStaticApp(app);

const port = app.config.TWODB_PORT;

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
