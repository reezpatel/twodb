#!/usr/bin/env tsx
/**
 * Dev-mode database wiring: run the REAL TwoDB provisioning logic against
 * your local Postgres cluster (from .env's TWODB_PG_ADMIN_URL) and print
 * the exact per-app connection strings to put in .env. This is the same
 * `provisionAppDatabase()` the orchestrator uses when you docker-install an
 * app — per-app schema + least-privilege role on the shared database — so
 * dev matches production. It is idempotent and ONLY ever creates/alters
 * that app's own schema and role; it never touches anything else on the
 * cluster.
 *
 * Usage:
 *   pnpm --filter @twodb/app-twodb provision:dev            # default set (tworoute)
 *   pnpm --filter @twodb/app-twodb provision:dev tworoute twodoo
 *
 * Then paste the printed DATABASE_URL line(s) into the repo-root .env.
 */
import { provisionAppDatabase } from "../src/db/provisioning.js";
import { createRegistryRepo } from "../src/db/registry.js";
import { openControlPlaneDb, bootstrapControlPlaneDb } from "../src/db/sqlite.js";
import { generateRegistrationToken } from "../src/orchestrator/tokens.js";
import { readFileSync, existsSync } from "node:fs";
import * as path from "node:path";

function env(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const envFile = path.resolve(import.meta.dirname, "../../../.env");
  if (!existsSync(envFile)) return undefined;
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(new RegExp(`^${key}=(.*)$`));
    if (m) return m[1].trim();
  }
  return undefined;
}

async function main() {
  const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ["tworoute"];
  const adminUrl = env("TWODB_PG_ADMIN_URL");
  if (!adminUrl) throw new Error("TWODB_PG_ADMIN_URL not set (env or .env)");
  const containerHost = env("TWODB_PG_CONTAINER_HOST") ?? "twodb-postgres";
  const sqliteFile = env("TWODB_SQLITE_FILE") ?? "./.data/twodb-control-plane.sqlite";

  // Registration tokens live in the control-plane SQLite registry, so the
  // dev script opens the same DB the gateway uses and stores a fresh
  // per-app token — same trust model as `POST /orchestrator/apps/:slug/
  // issue-token`, but runnable from the CLI without a session. Re-running
  // rotates the token (installs rotate too).
  const db = openControlPlaneDb(sqliteFile);
  await bootstrapControlPlaneDb(db);
  const registry = createRegistryRepo(db);

  for (const slug of slugs) {
    const r = await provisionAppDatabase(adminUrl, slug, containerHost);
    // Always issue a fresh token and print it (installs rotate too; the
    // plaintext can't be recovered from the stored hash anyway).
    const registrationToken = generateRegistrationToken();
    await registry.beginInstall(
      {
        slug,
        name: slug,
        version: "dev",
        shape: "backend",
        basePath: `/apps/${slug}`,
        hostId: "dev",
        capabilities: [],
      },
      registrationToken,
    );
    console.log(`\n# ${slug} — schema "${r.schema}", role "${r.role}" (same db as the admin URL)`);
    console.log(`${slug.toUpperCase()}_DATABASE_URL=${r.connectionString}`);
    console.log(`${slug.toUpperCase()}_PROVISION_TOKEN=${registrationToken}`);
    console.log(`# (docker installs instead inject: ${r.containerConnectionString})`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});


main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
