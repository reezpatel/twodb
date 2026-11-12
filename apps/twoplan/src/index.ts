import { registerWithGateway, fetchDatabaseCredentials } from "@twodb/core-platform/manifest";
import { loadTwoPlanConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadTwoPlanConfig();

  // Dev on the host: no DATABASE_URL in env — ask TwoDB for the credentials it provisioned.
  let dbUrl = config.DATABASE_URL;
  if (!process.env.DATABASE_URL && !process.env.TWOPLAN_DATABASE_URL) {
    try {
      const creds = await fetchDatabaseCredentials({ gatewayUrl: config.TWODB_GATEWAY_URL, registrationToken: config.TWODB_PROVISION_TOKEN, slug: "twoplan" });
      dbUrl = creds.connectionString;
      console.log(`[twoplan] using gateway-provisioned DB credentials (schema "${creds.schema}")`);
    } catch (err) {
      console.warn(`[twoplan] gateway credentials unavailable (${(err as Error).message}); falling back to config default`);
    }
  }

  const server = await buildServer({ ...config, DATABASE_URL: dbUrl });
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`TwoPlan listening on :${config.PORT}`);

  await registerWithGateway(manifest, { gatewayUrl: config.TWODB_GATEWAY_URL, registrationToken: config.TWODB_PROVISION_TOKEN, httpUrl: config.HTTP_URL }).catch((err) =>
    server.log.warn({ err }, "self-registration with TwoDB failed (non-fatal)"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
