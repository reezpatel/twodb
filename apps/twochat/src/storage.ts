import type { StorageAdapter } from "@twodb/core-data/storage";

/**
 * TwoChat attachment storage. Blobs live in the install's shared S3 bucket,
 * handed out by the control plane at boot and already prefix-scoped to
 * `twochat/`. S3 is mandatory: without it the app refuses to boot (see
 * index.ts) — there is no local-disk path.
 *
 * Blobs never need public URLs — every byte flows back through TwoChat's own
 * authorized routes.
 */

export interface ChatStorage extends StorageAdapter {
  /** Backend label for /healthz + logs ("s3"). */
  readonly backend: string;
}

/** Wraps the control-plane adapter (already prefix-scoped) with a label. */
export function wrapS3Storage(adapter: StorageAdapter): ChatStorage {
  return { backend: "s3", ...adapter };
}

