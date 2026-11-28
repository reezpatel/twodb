import type { DispatchHub } from "./hub.js";
import type { DispatchRepo } from "../db/repository.js";
import type { RunnerRow } from "../db/schema.js";
import type { StorageAdapter } from "@twodb/core-data/storage";

/**
 * /app archive store — backed by the install's shared S3 bucket. Runners zip
 * /app at VM shutdown and ship it here over their authenticated WS (vmArchive
 * frames); resume downloads it back. The adapter arrives already prefix-scoped
 * to `dispatch/` by the control plane. S3 is mandatory (dispatch refuses to
 * boot without it) — there is no local-disk path.
 *
 * Keys: `vm-archives/<identifier>/app-<utc-stamp>.zip`. In-memory assembly
 * keyed by identifier; sizes are bounded by the /app quota we give microvms
 * (2GB disk, realistically far less).
 */
const assembling = new Map<string, { parts: Buffer[]; runnerId: string }>();

export function registerArchiveStore(hub: DispatchHub, repo: DispatchRepo, storage: StorageAdapter): void {
  hub.onVmArchive(async (frame, runner) => {
    const identifier = String(frame.identifier ?? "");
    if (!identifier) return { error: "identifier required" };
    if (frame.begin) {
      assembling.set(identifier, { parts: [], runnerId: runner.id });
      return { ok: true };
    }
    const entry = assembling.get(identifier);
    if (!entry) return { error: "no archive in progress" };
    if (typeof frame.data === "string" && frame.data) {
      const chunk = Buffer.from(frame.data, "base64");
      entry.parts.push(chunk);
    }
    if (frame.done) {
      assembling.delete(identifier);
      const buf = Buffer.concat(entry.parts);
      if (entry.runnerId !== runner.id) return { error: "runner mismatch" };
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await storage.put(archiveKey(identifier, stamp), buf, { contentType: "application/zip" });
      return { ok: true, bytes: buf.length };
    }
    return { ok: true };
  });
}

function archiveKey(identifier: string, stamp: string): string {
  return `vm-archives/${identifier}/app-${stamp}.zip`;
}

/** True when at least one archive zip exists for the identifier. */
export async function archiveExists(storage: StorageAdapter, identifier: string): Promise<boolean> {
  return (await readLatestArchive(storage, identifier)) !== null;
}

/** Serves the newest stored archive zip for an identifier (runner resume path). */
export async function readLatestArchive(storage: StorageAdapter, identifier: string): Promise<Buffer | null> {
  try {
    const objects = (await storage.list(`vm-archives/${identifier}/`))
      .filter((o) => o.key.endsWith(".zip"))
      .sort((a, b) => (a.key < b.key ? -1 : 1));
    const latest = objects[objects.length - 1];
    if (!latest) return null;
    return await storage.get(latest.key);
  } catch {
    return null;
  }
}

export type { DispatchHub, DispatchRepo, RunnerRow };

