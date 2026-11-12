import { connectTwoDb } from "@twodb/twodb-core";
import { loadTwoDooConfig } from "./config.js";
import { buildServer } from "./server.js";
import { twodooManifest } from "./manifest.js";

async function main() {
  const config = loadTwoDooConfig();

  // Register with the control plane (token / TWODB_REGISTRATION_SECRET), start the
  // 10s heartbeat, and receive this app's Postgres config from it — no DATABASE_URL in env.
  const twodb = await connectTwoDb({ manifest: twodooManifest, httpUrl: config.HTTP_URL, gatewayUrl: config.TWODB_GATEWAY_URL, skipConnections: true });

  const server = await buildServer({ ...config, DATABASE_URL: twodb.config.postgres.connectionString, TWODB_DATA_KEY: twodb.dataKey ?? config.TWODB_DATA_KEY });
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`TwoDoo listening on :${config.PORT}`);

}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
