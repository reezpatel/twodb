import { registerWithGateway } from "@twodb/core-platform/manifest";
import { loadPaintressConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadPaintressConfig();
  const { app } = await buildServer(config);
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`Paintress listening on :${config.PORT}`);

  await registerWithGateway(manifest, {
    gatewayUrl: config.TWODB_GATEWAY_URL,
    registrationToken: config.TWODB_PROVISION_TOKEN,
    httpUrl: config.HTTP_URL,
  }).catch((err) => app.log.warn({ err }, "self-registration with TwoDB failed (gateway unreachable after retries, or token rejected — non-fatal)"));

  const stop = () => void app.close().then(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
