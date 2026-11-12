import { fetchDatabaseCredentials, registerWithGateway } from "@twodb/core-platform/manifest";
import { manifest } from "./manifest.js";
import { buildServer } from "./server.js";

async function main() {
  const port = Number(process.env.PORT ?? 6404);
  const gatewayUrl = process.env.TWODB_GATEWAY_URL ?? "http://localhost:6400";
  const registrationToken = process.env.TWOCONTACTS_PROVISION_TOKEN ?? process.env.TWODB_PROVISION_TOKEN ?? "";
  const httpUrl = process.env.HTTP_URL ?? `http://localhost:${port}`;
  const databaseUrl = process.env.TWOCONTACTS_DATABASE_URL ?? process.env.DATABASE_URL ??
    (await fetchDatabaseCredentials({ gatewayUrl, registrationToken, slug: "twocontacts" })).connectionString;
  const app = await buildServer({ databaseUrl, registrationToken, httpUrl });
  await app.listen({ host: "0.0.0.0", port });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void app.close(); });
  await registerWithGateway(manifest, { gatewayUrl, registrationToken, httpUrl }).catch(err => app.log.warn({ err }, "Gateway registration failed"));
}
main().catch(err => { console.error(err); process.exitCode = 1; });
