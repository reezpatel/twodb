import { connectTwoDb } from "@twodb/twodb-core";
import { loadArtisanConfig } from "./config.js";
import { buildServer } from "./server.js";
import { artisanManifest } from "./manifest.js";

async function main() {
  const config = loadArtisanConfig();

  // Register with the control plane (token / TWODB_REGISTRATION_SECRET), start the
  // 10s heartbeat, and receive this app's Postgres config from it — no DATABASE_URL in env.
  const twodb = await connectTwoDb({ manifest: artisanManifest, httpUrl: config.HTTP_URL, gatewayUrl: config.TWODB_GATEWAY_URL, skipConnections: true });

  const server = await buildServer({ ...config, DATABASE_URL: twodb.config.postgres.connectionString, TWODB_DATA_KEY: twodb.dataKey ?? config.TWODB_DATA_KEY });
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`Artisan listening on :${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
