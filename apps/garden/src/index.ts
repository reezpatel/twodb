import { connectTwoDb } from "@twodb/twodb-core";
import { loadGardenConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadGardenConfig();

  // Standalone dev (scripts/dev-shim.ts, no control plane): GARDEN_SKIP_REGISTER=1 + DATABASE_URL.
  // Otherwise register with the control plane (token / TWODB_REGISTRATION_SECRET), start the
  // 10s heartbeat, and receive Postgres config from it — no DATABASE_URL in env.
  const twodb = process.env.GARDEN_SKIP_REGISTER
    ? null
    : await connectTwoDb({ manifest, httpUrl: config.HTTP_URL, gatewayUrl: config.TWODB_GATEWAY_URL, skipConnections: true });

  const { app } = await buildServer(
    twodb
      ? { ...config, DATABASE_URL: twodb.config.postgres.connectionString, TWODB_DATA_KEY: twodb.dataKey ?? config.TWODB_DATA_KEY }
      : config,
  );
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`Garden listening on :${config.PORT}`);

  const stop = () => void Promise.all([app.close(), twodb?.close()]).then(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
