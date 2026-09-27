import { db } from "../../auth";
import type { StorageBackendTable } from "../../plugins/db";
import { createLocalDriver, createS3Driver, type StorageDriver } from "./driver";

// Caches one driver per backend; keys include the config so edits invalidate.

const cache = new Map<string, { key: string; driver: StorageDriver }>();

function driverFor(backend: StorageBackendTable): StorageDriver {
  const key = JSON.stringify([backend.type, backend.config]);
  const hit = cache.get(backend.id);
  if (hit && hit.key === key) return hit.driver;

  if (backend.type === "object") {
    const driver = createS3Driver(backend.config as never);
    cache.set(backend.id, { key, driver });
    return driver;
  }
  if (backend.type === "block") {
    const driver = createLocalDriver(backend.config as never);
    cache.set(backend.id, { key, driver });
    return driver;
  }
  throw new Error(`unknown storage backend type "${backend.type}"`);
}

/** Loads a backend row by id or name (must be enabled) and returns its driver. */
export async function getStorageDriver(ref: string): Promise<{ backend: StorageBackendTable; driver: StorageDriver }> {
  const backend = await db
    .selectFrom("storage_backend")
    .selectAll()
    .where((eb) => eb("id", "=", ref).or("name", "=", ref))
    .where("enabled", "=", true)
    .executeTakeFirst();
  if (!backend) throw new Error("storage backend not found");
  return { backend, driver: driverFor(backend) };
}

/** Driver for admin endpoints — works on disabled backends too. */
export async function getStorageDriverAnyState(ref: string): Promise<{ backend: StorageBackendTable; driver: StorageDriver }> {
  const backend = await db
    .selectFrom("storage_backend")
    .selectAll()
    .where((eb) => eb("id", "=", ref).or("name", "=", ref))
    .executeTakeFirst();
  if (!backend) throw new Error("storage backend not found");
  return { backend, driver: driverFor(backend) };
}
