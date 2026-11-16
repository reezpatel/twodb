import { connectTwoDb } from "@twodb/twodb-core";
import { loadTwoPagerConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadTwoPagerConfig();
  const twodb = await connectTwoDb({ manifest, httpUrl: config.HTTP_URL, gatewayUrl: config.TWODB_GATEWAY_URL });
  const server = await buildServer(
    { ...config, DATABASE_URL: twodb.config.postgres.connectionString, TWODB_DATA_KEY: twodb.dataKey ?? config.TWODB_DATA_KEY },
    { storage: twodb.storage },
  );
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`TwoPager listening on :${config.PORT}`);
  const stop = () => void server.close().then(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
