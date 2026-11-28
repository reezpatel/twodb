import { Agent, setGlobalDispatcher } from "undici";
import { connectTwoDb } from "@twodb/twodb-core";
import { loadToolkitConfig } from "./config.js";
import { buildServer } from "./server.js";
import { toolkitManifest } from "./manifest.js";
import { toolkitCli } from "./cli.js";

async function main() {
  // Pipeline runs are synchronous calls that stay silent for up to 4 hours; the default 300s headers/body timeouts of
  // fetch would abort them. Each call carries its own AbortSignal deadline instead.
  setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));
  const config = loadToolkitConfig();

  // Register with the control plane (token / TWODB_REGISTRATION_SECRET), start the
  // 10s heartbeat, and receive this app's Postgres config from it — no DATABASE_URL in env.
  const twodb = await connectTwoDb({ manifest: toolkitManifest, cli: toolkitCli, httpUrl: config.HTTP_URL, gatewayUrl: config.TWODB_GATEWAY_URL, skipConnections: true });

  const server = await buildServer({ ...config, DATABASE_URL: twodb.config.postgres.connectionString, TWODB_DATA_KEY: twodb.dataKey ?? config.TWODB_DATA_KEY }, twodb);
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`Toolkit listening on :${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
