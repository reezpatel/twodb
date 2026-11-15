import { connectTwoDb } from "@twodb/twodb-core";
import { loadFincalConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadFincalConfig();
  const twodb = await connectTwoDb({ manifest, httpUrl: config.HTTP_URL, gatewayUrl: config.TWODB_GATEWAY_URL, skipConnections: true });
  const server = await buildServer({ ...config, DATABASE_URL: twodb.config.postgres.connectionString, TWODB_DATA_KEY: twodb.dataKey ?? config.TWODB_DATA_KEY });
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`Fincal listening on :${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
