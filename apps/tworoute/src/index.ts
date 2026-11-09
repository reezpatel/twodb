import { registerWithGateway } from "@twodb/core-platform/manifest";
import { loadTwoRouteConfig } from "./config.js";
import { buildServer } from "./server.js";
import { tworouteManifest } from "./manifest.js";

async function main() {
  const config = loadTwoRouteConfig();
  const server = await buildServer(config);
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`TwoRoute listening on :${config.PORT}`);

  await registerWithGateway(tworouteManifest, {
    gatewayUrl: config.TWODB_GATEWAY_URL,
    registrationToken: config.TWODB_PROVISION_TOKEN,
    httpUrl: config.HTTP_URL,
  }).catch((err) => server.log.warn({ err }, "self-registration with TwoDB failed (non-fatal)"));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
