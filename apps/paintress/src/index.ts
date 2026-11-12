import { registerWithGateway, fetchDatabaseCredentials } from "@twodb/core-platform/manifest";
import { loadPaintressConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadPaintressConfig();

  // Dev on the host: no DATABASE_URL env — ask TwoDB for the credentials it
  // provisioned (token-guarded). Docker installs inject DATABASE_URL
  // directly and skip this (fetch fails fast on a rejected token; falls
  // back to the config default only when the gateway is simply absent).
  let dbUrl = config.DATABASE_URL;
  if (!process.env.DATABASE_URL && !process.env.PAINTRESS_DATABASE_URL) {
    try {
      const creds = await fetchDatabaseCredentials({
        gatewayUrl: config.TWODB_GATEWAY_URL,
        registrationToken: config.TWODB_PROVISION_TOKEN,
        slug: "paintress",
      });
      dbUrl = creds.connectionString;
      console.log(`[paintress] using gateway-provisioned DB credentials (schema "${creds.schema}")`);
    } catch (err) {
      console.warn(`[paintress] gateway credentials unavailable (${(err as Error).message}); falling back to config default`);
    }
  }

  const { app } = await buildServer({ ...config, DATABASE_URL: dbUrl });
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
