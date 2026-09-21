import path from "node:path";
import fs from "node:fs";
import Fastify from "fastify";
import fastifyEnv from "@fastify/env";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { sql } from "kysely";
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

// Baked deployments (docker image, tarball, nix) point TWODB_PLUGINS_DIR at a
// directory of plugin folders; any missing registry rows are seeded from
// their .build manifests so a fresh database boots fully loaded.
if (app.config.TWODB_PLUGINS_DIR) {
  const pluginsDir = app.config.TWODB_PLUGINS_DIR;
  for (const entry of fs.existsSync(pluginsDir) ? fs.readdirSync(pluginsDir) : []) {
    const manifestPath = path.join(pluginsDir, entry, ".build", "package.json");
    if (!fs.existsSync(manifestPath)) continue;
    let pkg: { name?: string; version?: string; twodb?: { identifier?: string; provides?: string[]; requires?: string[] } };
    try {
      pkg = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
      app.log.warn(`invalid plugin manifest at ${manifestPath} — skipping seed`);
      continue;
    }
    if (!pkg.twodb?.identifier) continue;

    await app.db
      .insertInto("admin_plugins")
      .values({
        identifier: pkg.twodb.identifier,
        name: pkg.name ?? "",
        version: pkg.version ?? "0.0.0",
        extracted_path: path.join(pluginsDir, entry, ".build"),
        provides: sql`${JSON.stringify(pkg.twodb.provides ?? [])}::jsonb` as never,
        manifest: sql`${JSON.stringify({ ...pkg.twodb })}::jsonb` as never,
      })
      .onConflict((qb) => qb.doNothing())
      .execute();
    app.log.info(`seeded plugin registry row for ${pkg.twodb.identifier}`);
  }
}

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
