import { fetchDatabaseCredentials, registerWithGateway } from "@twodb/core-platform/manifest";
import { loadTwoThingConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadTwoThingConfig();

  // Dev on the host: no DATABASE_URL env — ask TwoDB for the credentials it
  // provisioned (token-guarded). Docker installs inject DATABASE_URL directly.
  let dbUrl = config.DATABASE_URL;
  if (!process.env.DATABASE_URL && !process.env.TWOTHING_DATABASE_URL) {
    try {
      const creds = await fetchDatabaseCredentials({ gatewayUrl: config.TWODB_GATEWAY_URL, registrationToken: config.TWODB_PROVISION_TOKEN, slug: "twothing" });
      dbUrl = creds.connectionString;
      console.log(`[twothing] using gateway-provisioned DB credentials (schema "${creds.schema}")`);
    } catch (err) {
      console.warn(`[twothing] gateway credentials unavailable (${(err as Error).message}); falling back to config default`);
    }
  }

  const server = await buildServer({ ...config, DATABASE_URL: dbUrl });
  await server.app.listen({ port: config.PORT, host: "0.0.0.0" });
  console.log(`TwoThing listening on :${config.PORT}`);

  await registerWithGateway(manifest, {
    gatewayUrl: config.TWODB_GATEWAY_URL,
    registrationToken: config.TWODB_PROVISION_TOKEN,
    httpUrl: config.HTTP_URL,
  }).catch((err) => console.warn(`[twothing] self-registration with TwoDB failed (non-fatal): ${(err as Error).message}`));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
