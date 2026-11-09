// Dev/test helper: seeds a throwaway org + workspace + workspace-level API
// key into the control-plane SQLite so the orchestrator/registry endpoints
// can be exercised headlessly (real auth is passkeys/Google/PocketID —
// none of which can be driven from a script). Run AFTER TwoDB has booted
// once (so its tables exist):
//
//   TWODB_SQLITE_FILE=.data/twodb-control-plane.sqlite tsx scripts/seed-test-identity.ts
//
// Prints the raw API key exactly once — use it as `x-twodb-api-key`.

import { createWorkspacePlatform } from "@twodb/core-platform/auth";
import { openControlPlaneDb } from "../src/db/sqlite.js";

const sqliteFile = process.env.TWODB_SQLITE_FILE ?? "./.data/twodb-control-plane.sqlite";

const db = openControlPlaneDb(sqliteFile);
const platform = createWorkspacePlatform(db as any);

const existing = await db.selectFrom("workspace").selectAll().where("slug", "=", "smoke-test").executeTakeFirst();
if (existing) {
  console.error(`workspace "smoke-test" already exists (id ${existing.id}) — delete the SQLite file to reseed`);
  process.exit(1);
}

const org = await platform.createOrg("Smoke Test Org");
const workspace = await platform.createWorkspace(org.id, "Smoke Test");
const key = await platform.issueApiKey(workspace.id, "smoke-test-script", "smoke-test");

console.log(JSON.stringify({ workspaceId: workspace.id, apiKey: key.rawKey }, null, 2));
await db.destroy();
