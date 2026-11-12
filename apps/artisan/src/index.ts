import { registerWithGateway, fetchDatabaseCredentials } from "@twodb/core-platform/manifest";
import { loadArtisanConfig } from "./config.js";
import { buildServer } from "./server.js";
import { artisanManifest } from "./manifest.js";

async function main() {
  const config = loadArtisanConfig();

  // Dev on the host: no DATABASE_URL env — ask TwoDB for the credentials it
  // provisioned (token-guarded). Docker installs inject DATABASE_URL
  // directly and skip this (fetch fails fast on a rejected token; falls
  // back to the config default only when the gateway is simply absent).
  let dbUrl = config.DATABASE_URL;
  if (!process.env.DATABASE_URL && !process.env.ARTISAN_DATABASE_URL) {
    try {
      const creds = await fetchDatabaseCredentials({
        gatewayUrl: config.TWODB_GATEWAY_URL,
        registrationToken: config.TWODB_PROVISION_TOKEN,
        slug: "artisan",
      });
      dbUrl = creds.connectionString;
      console.log(`[artisan] using gateway-provisioned DB credentials (schema "${creds.schema}")`);
    } catch (err) {
      console.warn(`[artisan] gateway credentials unavailable (${(err as Error).message}); falling back to config default`);
    }
  }

  const server = await buildServer({ ...config, DATABASE_URL: dbUrl });
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`Artisan listening on :${config.PORT}`);

  await registerWithGateway(artisanManifest, {
    gatewayUrl: config.TWODB_GATEWAY_URL,
    registrationToken: config.TWODB_PROVISION_TOKEN,
    httpUrl: config.HTTP_URL,
  }).catch((err) => server.log.warn({ err }, "self-registration with TwoDB failed (non-fatal)"));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
