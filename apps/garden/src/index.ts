import { registerWithGateway, fetchDatabaseCredentials } from "@twodb/core-platform/manifest";
import { loadGardenConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadGardenConfig();

  // Dev on the host without GARDEN_DATABASE_URL: ask TwoDB for the credentials
  // it provisioned (token-guarded). Docker installs inject DATABASE_URL.
  let dbUrl = config.DATABASE_URL;
  if (!process.env.DATABASE_URL && !process.env.GARDEN_DATABASE_URL) {
    try {
      const creds = await fetchDatabaseCredentials({ gatewayUrl: config.TWODB_GATEWAY_URL, registrationToken: config.TWODB_PROVISION_TOKEN, slug: "garden" });
      dbUrl = creds.connectionString;
      console.log(`[garden] using gateway-provisioned DB credentials (schema "${creds.schema}")`);
    } catch (err) {
      console.warn(`[garden] gateway credentials unavailable (${(err as Error).message}); falling back to config default`);
    }
  }

  const { app } = await buildServer({ ...config, DATABASE_URL: dbUrl });
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`Garden listening on :${config.PORT}`);

  if (!process.env.GARDEN_SKIP_REGISTER) {
    await registerWithGateway(manifest, {
      gatewayUrl: config.TWODB_GATEWAY_URL,
      registrationToken: config.TWODB_PROVISION_TOKEN,
      httpUrl: config.HTTP_URL,
    }).catch((err) => app.log.warn({ err }, "self-registration with TwoDB failed (non-fatal)"));
  }

  const stop = () => void app.close().then(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
