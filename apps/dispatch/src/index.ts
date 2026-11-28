import { connectTwoDb } from "@twodb/twodb-core";
import { loadDispatchConfig } from "./config.js";
import { buildServer } from "./server.js";
import { dispatchManifest } from "./manifest.js";

async function main() {
  const config = loadDispatchConfig();

  // Register with the control plane (token / TWODB_REGISTRATION_SECRET), start the
  // 10s heartbeat, and receive this app's Postgres + S3 config from it — no DATABASE_URL in env.
  const twodb = await connectTwoDb({ manifest: dispatchManifest, httpUrl: config.HTTP_URL, gatewayUrl: config.TWODB_GATEWAY_URL });
  // /app archives live in the install's shared S3 bucket — mandatory, no local fallback.
  if (!twodb.storage) throw new Error("Dispatch requires S3: the control plane has no TWODB_S3_* configured");

  const server = await buildServer(
    { ...config, DATABASE_URL: twodb.config.postgres.connectionString, TWODB_DATA_KEY: twodb.dataKey ?? config.TWODB_DATA_KEY },
    { storage: twodb.storage },
  );
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`Dispatch listening on :${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
