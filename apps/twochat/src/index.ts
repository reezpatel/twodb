import { connectTwoDb } from "@twodb/twodb-core";
import { loadTwoChatConfig } from "./config.js";
import { buildServer } from "./server.js";
import { twochatManifest } from "./manifest.js";

async function main() {
  const config = loadTwoChatConfig();

  // Register with the control plane (token / TWODB_REGISTRATION_SECRET), start the
  // 10s heartbeat, and receive this app's Postgres config from it — no DATABASE_URL in env.
  const twodb = await connectTwoDb({ manifest: twochatManifest, httpUrl: config.HTTP_URL, gatewayUrl: config.TWODB_GATEWAY_URL });
  // Attachment blobs live in the install's shared S3 bucket — mandatory, no local fallback.
  if (!twodb.storage) throw new Error("TwoChat requires S3: the control plane has no TWODB_S3_* configured");

  const server = await buildServer(
    { ...config, DATABASE_URL: twodb.config.postgres.connectionString, TWODB_DATA_KEY: twodb.dataKey ?? config.TWODB_DATA_KEY },
    { twodb, storage: twodb.storage ?? undefined },
  );
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`TwoChat listening on :${config.PORT} (storage: s3)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
