import { toEndpointJson } from "@twodb/core-platform/manifest";
import { loadTwoDbConfig } from "./config.js";
import { openControlPlaneDb, bootstrapControlPlaneDb } from "./db/sqlite.js";
import { createRegistryRepo } from "./db/registry.js";
import { bootstrapAuthTables } from "./auth/index.js";
import { buildServer } from "./gateway/server.js";
import { twodbManifest } from "./manifest.js";

async function main() {
  const config = loadTwoDbConfig();

  const db = openControlPlaneDb(config.TWODB_SQLITE_FILE);
  await bootstrapControlPlaneDb(db);
  // better-auth's own tables (user/session/account/passkey/apikey/verification) —
  // this is what makes TwoDB truly zero-setup on first run.
  await bootstrapAuthTables(db, config);

  // TwoDB registers itself directly (see registry.ts's registerSelf doc
  // comment — it's the one app that doesn't go through its own install/
  // Docker lifecycle), so `twodb apps` / the admin UI can show its own
  // control-plane endpoints the same way as any other app.
  const registry = createRegistryRepo(db);
  await registry.registerSelf({
    slug: twodbManifest.slug,
    name: twodbManifest.name,
    version: twodbManifest.version,
    shape: twodbManifest.shape,
    basePath: twodbManifest.basePath,
    httpUrl: config.AUTH_BASE_URL,
    hostId: config.TWODB_HOST_ID,
    capabilities: twodbManifest.capabilities,
    manifestJson: toEndpointJson(twodbManifest),
  });

  const server = await buildServer(db, config);
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`TwoDB gateway listening on :${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
