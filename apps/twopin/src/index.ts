import { registerWithGateway, fetchDatabaseCredentials } from "@twodb/core-platform/manifest";
import { loadTwoPinConfig } from "./config.js";
import { buildServer } from "./server.js";
import { manifest } from "./manifest.js";

async function main() {
  const config = loadTwoPinConfig();

  // Dev on the host: no DATABASE_URL env — ask TwoDB for the credentials it
  // provisioned (token-guarded). Docker installs inject DATABASE_URL
  // directly and skip this (fetch fails fast on a rejected token; falls
  // back to the config default only when the gateway is simply absent).
  let dbUrl = config.DATABASE_URL;
  if (!process.env.DATABASE_URL && !process.env.TWOPIN_DATABASE_URL) {
    try {
      const creds = await fetchDatabaseCredentials({
        gatewayUrl: config.TWODB_GATEWAY_URL,
        registrationToken: config.TWODB_PROVISION_TOKEN,
        slug: "twopin",
      });
      dbUrl = creds.connectionString;
      console.log(`[twopin] using gateway-provisioned DB credentials (schema "${creds.schema}")`);
    } catch (err) {
      console.warn(`[twopin] gateway credentials unavailable (${(err as Error).message}); falling back to config default`);
    }
  }

  const server = await buildServer({ ...config, DATABASE_URL: dbUrl });
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
  server.log.info(`TwoPin listening on :${config.PORT}`);

  await registerWithGateway(manifest, {
    gatewayUrl: config.TWODB_GATEWAY_URL,
    registrationToken: config.TWODB_PROVISION_TOKEN,
    httpUrl: config.HTTP_URL,
  }).catch((err) => server.log.warn({ err }, "self-registration with TwoDB failed (gateway unreachable after retries, or token rejected — non-fatal)"));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
