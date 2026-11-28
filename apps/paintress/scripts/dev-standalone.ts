/**
 * Standalone dev server: boots Paintress WITHOUT the twodb control plane
 * (no registration, no heartbeat) straight from env config. For local UI/API
 * testing when the gateway is not running. Production boot is src/index.ts
 * (S3 mandatory there); here blobs go to a local dir instead.
 *
 *   npx tsx scripts/dev-standalone.ts        → listens on :6414
 */
import { createLocalStorage } from "@twodb/core-data/storage";
import { withKeyPrefix } from "@twodb/twodb-core";
import { loadPaintressConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";

const config = loadPaintressConfig();
const { app } = await buildServer(config, { storage: withKeyPrefix(createLocalStorage({ rootDir: "./.data/blobs" }), "paintress/") });
await app.listen({ port: config.PORT, host: "127.0.0.1" });
app.log.info(`Paintress (standalone) listening on :${config.PORT}`);
