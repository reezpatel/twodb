#!/usr/bin/env tsx
/**
 * Dev-mode provisioning: runs the REAL TwoDB provisioning logic against
 * your local Postgres cluster (from .env's TWODB_PG_ADMIN_URL) — the same
 * `provisionAppDatabase()` the orchestrator uses on docker installs:
 * per-app schema + least-privilege role on the shared database. It also
 * issues a fresh per-app registration token (same as
 * `POST /orchestrator/apps/:slug/issue-token`) and stores the CURRENT
 * encrypted credentials in the control-plane registry, so host-run dev
 * apps can fetch them at boot via GET /registry/config.
 *
 * Usage:
 *   pnpm --filter @twodb/app-twodb provision:dev            # default set (tworoute)
 *   pnpm --filter @twodb/app-twodb provision:dev tworoute twochat
 *
 * Then paste the printed <SLUG>_PROVISION_TOKEN line(s) into .env — that's
 * the only secret the app needs (db credentials come from the gateway).
 */
import { provisionAppDatabase, encryptSecret, decryptSecret } from "../src/db/provisioning.js";
import { createRegistryRepo } from "../src/db/registry.js";
import { openControlPlaneDb, bootstrapControlPlaneDb } from "../src/db/sqlite.js";
import { generateAppToken } from "../src/orchestrator/tokens.js";
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
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
  const authSecret = env("AUTH_SECRET") ?? "smoketest-secret-0123456789abcdef";

  const db = openControlPlaneDb(sqliteFile);
  await bootstrapControlPlaneDb(db);
  const registry = createRegistryRepo(db);

  for (const slug of slugs) {
    // Keep the role's current password (credentials are stable); only set one on first create.
    const prev = await registry.getApp(slug);
    let existingPassword: string | undefined;
    try {
      if (prev?.pg_connection_string_encrypted) existingPassword = decodeURIComponent(new URL(decryptSecret(prev.pg_connection_string_encrypted, authSecret)).password);
    } catch {}
    const r = await provisionAppDatabase(adminUrl, slug, containerHost, { existingPassword });
    // Always issue a fresh token and print it (installs rotate too; the
    // plaintext can't be recovered from the stored hash anyway).
    const appToken = generateAppToken();
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
    );
    await registry.revokeTokens(slug, "api");
    await registry.issueToken(slug, "api", appToken, 30 * 24 * 60 * 60 * 1000);
    // provisionAppDatabase ROTATED the role password — persist the new
    // encrypted connection string so the token-guarded
    // GET /registry/config serves CURRENT credentials, not whatever
    // an older run/install happened to store.
    await registry.setProvisioning(slug, r.schema, r.role, encryptSecret(r.containerConnectionString, authSecret));
    const existing = await registry.getApp(slug);
    if (!existing?.data_key_encrypted) {
      await registry.setDataKey(slug, encryptSecret(randomBytes(32).toString("hex"), authSecret));
    }
    console.log(`\n# ${slug} — schema "${r.schema}", role "${r.role}"`);
    console.log(`# optional — apps normally self-register using TWODB_REGISTRATION_SECRET; to pin a token: TWODB_APP_TOKEN=${appToken}  (${slug})`);
    console.log(`# (db credentials are delivered at boot via GET /registry/config — nothing to paste)`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
