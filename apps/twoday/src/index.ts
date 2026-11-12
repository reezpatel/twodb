import { connectTwoDb } from "@twodb/twodb-core";
import { manifest } from "./manifest.js";
import { buildServer } from "./server.js";

async function main() {
  const port = Number(process.env.PORT ?? 6403);
  const httpUrl = process.env.HTTP_URL ?? `http://localhost:${port}`;
  // Register + heartbeat with the control plane and receive Postgres config from it.
  const twodb = await connectTwoDb({ manifest, httpUrl, skipConnections: true });
  const app = await buildServer({ databaseUrl: twodb.config.postgres.connectionString });
  await app.listen({ host: "0.0.0.0", port });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void app.close(); void twodb.close(); });
}
main().catch(err => { console.error(err); process.exitCode = 1; });
