import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import type { Readable } from "node:stream";

/**
 * Local read-through cache for site blobs, keyed by sha256 (content-addressed → immutable, never stale).
 * Files are fetched from S3 on first hit (concurrent hits share one fetch), written atomically, and the
 * least-recently-used are evicted once the directory exceeds `maxBytes`.
 */
export class BlobCache {
  private entries = new Map<string, { size: number; used: number }>();
  private inflight = new Map<string, Promise<string>>();
  private total = 0;
  private ready: Promise<void>;

  constructor(
    private dir: string,
    private maxBytes: number,
  ) {
    this.ready = this.scan();
  }

  private file(sha: string) {
    return path.join(this.dir, sha.slice(0, 2), sha);
  }

  private async scan() {
    await mkdir(this.dir, { recursive: true });
    for (const d of await readdir(this.dir).catch(() => [] as string[])) {
      const sub = path.join(this.dir, d);
      for (const f of await readdir(sub).catch(() => [] as string[])) {
        if (f.includes(".tmp-")) { await rm(path.join(sub, f), { force: true }); continue; }
        const st = await stat(path.join(sub, f)).catch(() => null);
        if (st?.isFile()) { this.entries.set(f, { size: st.size, used: st.mtimeMs }); this.total += st.size; }
      }
    }
  }

  /** Absolute path of the cached blob, fetching it with `load` when missing. */
  async path(sha: string, load: () => Promise<Buffer>): Promise<string> {
    await this.ready;
    const p = this.file(sha);
    const hit = this.entries.get(sha);
    if (hit && existsSync(p)) {
      if (Date.now() - hit.used > 60_000) { hit.used = Date.now(); void utimes(p, new Date(), new Date()).catch(() => {}); }
      return p;
    }
    let pending = this.inflight.get(sha);
    if (!pending) {
      pending = (async () => {
        const data = await load();
        await mkdir(path.dirname(p), { recursive: true });
        const tmp = `${p}.tmp-${randomBytes(4).toString("hex")}`;
        await writeFile(tmp, data);
        await rename(tmp, p);
        const prev = this.entries.get(sha);
        if (prev) this.total -= prev.size;
        this.entries.set(sha, { size: data.length, used: Date.now() });
        this.total += data.length;
        void this.evict(sha);
        return p;
      })().finally(() => this.inflight.delete(sha));
      this.inflight.set(sha, pending);
    }
    return pending;
  }

  stream(p: string): Readable {
    return createReadStream(p);
  }

  /** Drops a blob (e.g. after its last version is deleted). */
  async drop(sha: string) {
    await this.ready;
    const e = this.entries.get(sha);
    if (!e) return;
    this.entries.delete(sha);
    this.total -= e.size;
    await rm(this.file(sha), { force: true });
  }

  private async evict(keep: string) {
    if (this.total <= this.maxBytes) return;
    const target = this.maxBytes * 0.9;
    const byAge = [...this.entries.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [sha, e] of byAge) {
      if (this.total <= target) break;
      if (sha === keep) continue;
      this.entries.delete(sha);
      this.total -= e.size;
      await rm(this.file(sha), { force: true });
    }
  }

  get stats() {
    return { files: this.entries.size, bytes: this.total };
  }
}
