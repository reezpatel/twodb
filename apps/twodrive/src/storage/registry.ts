import { z } from "zod";
import type { Kysely } from "@twodb/core-data/db";
import type { TwoDriveDb, BackendRow } from "../db/schema.js";
import { createS3Driver, createLocalDriver, type StorageDriver } from "./driver.js";
import { decryptSecret } from "../crypto.js";

// Config schemas per backend type. Secrets inside config (s3 secretAccessKey)
// are AES-256-GCM encrypted at rest; decrypted only when building a driver.
export const s3ConfigSchema = z.object({
  endpoint: z.string().min(1),
  region: z.string().default("us-east-1"),
  bucket: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  forcePathStyle: z.boolean().default(true),
});

export const localConfigSchema = z.object({
  rootPath: z.string().min(1),
});

export type S3Config = z.infer<typeof s3ConfigSchema>;
export type LocalConfig = z.infer<typeof localConfigSchema>;

// ---------------------------------------------------------------------------
// Driver registry — caches one driver per backend; the cache key includes the
// config so edits invalidate (ported from the legacy registry.ts).
// ---------------------------------------------------------------------------

const cache = new Map<string, { key: string; driver: StorageDriver }>();

function driverFor(backend: BackendRow, dataKey: string): StorageDriver {
  const parsed = JSON.parse(backend.config) as Record<string, unknown>;
  // Key on plaintext-equivalent config (secret still encrypted in the key is
  // fine — it changes on rotation, which is exactly when we want to rebuild).
  const key = JSON.stringify([backend.type, parsed]);

  if (backend.type === "s3") {
    const cfg = s3ConfigSchema.parse(parsed);
    // The stored secretAccessKey is encrypted — swap in the plaintext only
    // for driver construction; it never lands back in the cache key.
    const secretAccessKey = decryptSecret(cfg.secretAccessKey, dataKey);
    const hit = cache.get(backend.id);
    if (hit && hit.key === key) return hit.driver;
    const driver = createS3Driver({ ...cfg, secretAccessKey });
    cache.set(backend.id, { key, driver });
    return driver;
  }
  if (backend.type === "local") {
    const cfg = localConfigSchema.parse(parsed);
    const hit = cache.get(backend.id);
    if (hit && hit.key === key) return hit.driver;
    const driver = createLocalDriver(cfg);
    cache.set(backend.id, { key, driver });
    return driver;
  }
  throw new Error(`unknown storage backend type "${backend.type}"`);
}

/** Loads a backend by id or name (must be enabled) and returns its driver. */
export async function getStorageDriver(db: Kysely<TwoDriveDb>, workspaceId: string, ref: string, dataKey: string) {
  const backend = await db
    .selectFrom("drive_backend")
    .selectAll()
    .where("workspace_id", "=", workspaceId)
    .where((eb) => eb("id", "=", ref).or("name", "=", ref))
    .where("enabled", "=", true)
    .executeTakeFirst();
  if (!backend) throw new Error("storage backend not found");
  return { backend, driver: driverFor(backend, dataKey) };
}

/** Driver for settings/test endpoints — works on disabled backends too. */
export async function getStorageDriverAnyState(db: Kysely<TwoDriveDb>, workspaceId: string, ref: string, dataKey: string) {
  const backend = await db
    .selectFrom("drive_backend")
    .selectAll()
    .where("workspace_id", "=", workspaceId)
    .where((eb) => eb("id", "=", ref).or("name", "=", ref))
    .executeTakeFirst();
  if (!backend) throw new Error("storage backend not found");
  return { backend, driver: driverFor(backend, dataKey) };
}

/** Builds a driver from raw (unencrypted) config — used by the test-before-create flow. */
export function driverFromRawConfig(type: "s3" | "local", raw: Record<string, unknown>): StorageDriver {
  if (type === "s3") {
    const cfg = s3ConfigSchema.parse(raw);
    return createS3Driver(cfg);
  }
  if (type === "local") {
    const cfg = localConfigSchema.parse(raw);
    return createLocalDriver(cfg);
  }
  throw new Error(`unknown storage backend type "${type}"`);
}
