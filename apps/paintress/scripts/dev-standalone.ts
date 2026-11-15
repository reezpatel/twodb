/**
 * Standalone dev server: boots Paintress WITHOUT the twodb control plane
 * (no registration, no heartbeat) straight from env config. For local UI/API
 * testing when the gateway is not running. Production boot is src/index.ts.
 *
 *   npx tsx scripts/dev-standalone.ts        → listens on :6414
 */
import { loadPaintressConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";

const config = loadPaintressConfig();
const { app } = await buildServer(config);
await app.listen({ port: config.PORT, host: "127.0.0.1" });
app.log.info(`Paintress (standalone) listening on :${config.PORT}`);
