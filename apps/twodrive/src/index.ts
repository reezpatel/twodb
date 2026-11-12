import { connectTwoDb } from "@twodb/twodb-core";
import { loadTwoDriveConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadTwoDriveConfig();

  // Register with the control plane (token / TWODB_REGISTRATION_SECRET), start the
  // 10s heartbeat, and receive this app's Postgres config from it — no DATABASE_URL in env.
  const twodb = await connectTwoDb({ manifest, httpUrl: config.HTTP_URL, gatewayUrl: config.TWODB_GATEWAY_URL, skipConnections: true });

  const server = await buildServer({ ...config, DATABASE_URL: twodb.config.postgres.connectionString, TWODB_DATA_KEY: twodb.dataKey ?? config.TWODB_DATA_KEY });
  await server.app.listen({ port: config.PORT, host: "0.0.0.0" });
  server.app.log.info(`TwoDrive listening on :${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
