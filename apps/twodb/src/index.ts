import { registerWithGateway } from "@twodb/core-platform/manifest";
import { loadTwoDbConfig } from "./config.js";
import { openControlPlaneDb, bootstrapControlPlaneDb } from "./db/sqlite.js";
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

  const server = await buildServer(db, config);
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`TwoDB gateway listening on :${config.PORT}`);

  // TwoDB registers itself too, so `twodb apps` / the admin UI can show its
  // own control-plane endpoints the same way as any other app.
  await registerWithGateway(twodbManifest, {
    gatewayUrl: config.AUTH_BASE_URL,
    provisionToken: config.AUTH_SECRET,
    httpUrl: config.AUTH_BASE_URL,
    hostId: process.env.TWODB_HOST_ID ?? "local",
  }).catch((err) => server.log.warn({ err }, "self-registration failed (non-fatal)"));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
