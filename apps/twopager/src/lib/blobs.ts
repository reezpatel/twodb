import { createHash } from "node:crypto";
import type { StorageAdapter } from "@twodb/core-data/storage";
import type { Db } from "../db/schema.js";
import type { BlobCache } from "../engine/cache.js";

export const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
export const blobKey = (siteId: string, sha: string) => `sites/${siteId}/${sha}`;

/** S3 (source of truth) + local cache (what is served). */
export class Blobs {
  constructor(
    private storage: StorageAdapter,
    readonly cache: BlobCache,
    private db: Db,
  ) {}

  /** Uploads blobs this site doesn't already hold (content-addressed → versions share storage). */
  async putAll(siteId: string, blobs: Map<string, { data: Buffer; contentType: string }>) {
    const shas = [...blobs.keys()];
    if (!shas.length) return;
    const existing = new Set<string>();
    for (let i = 0; i < shas.length; i += 500) {
      const rows = await this.db.selectFrom("site_file").select("sha256").distinct().where("site_id", "=", siteId).where("sha256", "in", shas.slice(i, i + 500)).execute();
      for (const r of rows as any[]) existing.add(r.sha256);
    }
    const todo = shas.filter((s) => !existing.has(s));
    const queue = [...todo];
    await Promise.all(
      Array.from({ length: Math.min(8, queue.length) }, async () => {
        for (let sha = queue.pop(); sha; sha = queue.pop()) {
          const b = blobs.get(sha)!;
          await this.storage.put(blobKey(siteId, sha), b.data, { contentType: b.contentType });
        }
      }),
    );
  }

  /** Path of the cached blob on local disk (filled from S3 on a miss). */
  localPath(siteId: string, sha: string): Promise<string> {
    return this.cache.path(sha, () => this.storage.get(blobKey(siteId, sha)));
  }

  read(siteId: string, sha: string): Promise<Buffer> {
    return this.storage.get(blobKey(siteId, sha));
  }

  /** Deletes blobs of `siteId` that no remaining file row references. */
  async gc(siteId: string, candidates: Iterable<string>) {
    const shas = [...new Set(candidates)];
    for (let i = 0; i < shas.length; i += 500) {
      const chunk = shas.slice(i, i + 500);
      const still = new Set(((await this.db.selectFrom("site_file").select("sha256").distinct().where("site_id", "=", siteId).where("sha256", "in", chunk).execute()) as any[]).map((r) => r.sha256));
      for (const sha of chunk) {
        if (still.has(sha)) continue;
        await this.storage.delete(blobKey(siteId, sha)).catch(() => {});
        // another site may hold the same bytes; the cache is content-addressed so it just refetches on demand
        await this.cache.drop(sha);
      }
    }
  }

  async deleteSite(siteId: string) {
    for (const o of await this.storage.list(`sites/${siteId}/`)) {
      await this.storage.delete(o.key).catch(() => {});
    }
  }
}
