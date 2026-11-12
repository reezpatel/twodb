import { connectTwoDb } from "@twodb/twodb-core";
import { loadPaintressConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadPaintressConfig();

  // Register with the control plane (token / TWODB_REGISTRATION_SECRET), start the
  // 10s heartbeat, and receive this app's Postgres config from it — no DATABASE_URL in env.
  const twodb = await connectTwoDb({ manifest, httpUrl: config.HTTP_URL, gatewayUrl: config.TWODB_GATEWAY_URL });

  const { app } = await buildServer({ ...config, DATABASE_URL: twodb.config.postgres.connectionString, TWODB_DATA_KEY: twodb.dataKey ?? config.TWODB_DATA_KEY }, { storage: twodb.storage });
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`Paintress listening on :${config.PORT}`);

  const stop = () => void app.close().then(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
