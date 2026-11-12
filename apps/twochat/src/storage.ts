import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { StorageAdapter } from "@twodb/core-data/storage";

/**
 * TwoChat attachment storage. TwoDrive (the ecosystem's S3 provider) is still
 * in development, so v1 ships two interchangeable backends behind one
 * interface — the rest of the app never knows which one is live:
 *
 *  - local  : filesystem under TWOCHAT_STORAGE_DIR (dev default, zero deps)
 *  - twodrive: STUB for TwoDrive's S3 API — a thin placeholder that records
 *              where objects WILL go once TwoDrive ships its S3 endpoint.
 *              It deliberately fails loud ("not yet available") rather than
 *              silently writing to disk, so a misconfigured prod env can't
 *              half-work. Swap `createTwoDriveStorage`'s body for the real
 *              S3 client when TwoDrive lands — nothing else changes.
 *
 * The interface mirrors @twodb/core-data/storage's StorageAdapter (put/get/
 * getStream/delete/list) plus a serve helper for streaming downloads back
 * through TwoChat's own API with auth (the Gateway owns routing, so blobs
 * never need public URLs — every byte flows through an authorized route).
 */

export interface ChatStorage extends StorageAdapter {
  /** Backend label for /healthz + logs ("local" | "twodrive-stub"). */
  readonly backend: string;
}

export function createLocalStorage(rootDir: string): ChatStorage {
  const root = path.resolve(rootDir);

  function resolveSafe(key: string): string {
    const full = path.normalize(path.join(root, key));
    if (!full.startsWith(path.normalize(root))) throw new Error(`storage: key escapes root dir: ${key}`);
    return full;
  }

  return {
    backend: "local",
    async put(key, data, opts) {
      const full = resolveSafe(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      const buf = Buffer.isBuffer(data) ? data : await streamToBuffer(data);
      await fs.writeFile(full, buf);
      if (opts?.contentType) await fs.writeFile(`${full}.contenttype`, opts.contentType, "utf8");
      return { key, size: buf.length, contentType: opts?.contentType };
    },
    async get(key) {
      return fs.readFile(resolveSafe(key));
    },
    async getStream(key) {
      const { createReadStream } = await import("node:fs");
      return createReadStream(resolveSafe(key));
    },
    async delete(key) {
      await fs.rm(resolveSafe(key), { force: true });
      await fs.rm(`${resolveSafe(key)}.contenttype`, { force: true });
    },
    async list(prefix) {
      const dir = resolveSafe(prefix);
      let entries: string[] = [];
      try {
        entries = await fs.readdir(dir);
      } catch {
        return [];
      }
      const out = [];
      for (const entry of entries) {
        if (entry.endsWith(".contenttype")) continue;
        const full = path.join(dir, entry);
        const stat = await fs.stat(full).catch(() => null);
        if (stat?.isFile()) {
          const contentType = await fs.readFile(`${full}.contenttype`, "utf8").catch(() => "");
          out.push({ key: keyPath(root, full), size: stat.size, contentType: contentType || undefined });
        }
      }
      return out;
    },
  };
}

/**
 * STUB for TwoDrive's S3 backend (in development). Keys and content types are
 * decided now so the DB schema and message payloads won't churn; only the
 * actual S3 round-trip waits for TwoDrive. Configure with backend=twodrive to
 * exercise the error paths; flip the internals when TwoDrive ships.
 */
export function createTwoDriveStorage(baseUrl: string): ChatStorage {
  const unavailable = (op: string): never => {
    throw new Error(`twodrive storage: ${op} not yet available (TwoDrive S3 API in development; set TWOCHAT_STORAGE_BACKEND=local meanwhile) — endpoint ${baseUrl}`);
  };
  return {
    backend: "twodrive-stub",
    async put(): Promise<never> {
      return unavailable("put");
    },
    async get(): Promise<never> {
      return unavailable("get");
    },
    async getStream(): Promise<never> {
      return unavailable("getStream");
    },
    async delete(): Promise<void> {
      unavailable("delete");
    },
    async list(): Promise<never> {
      return unavailable("list");
    },
  };
}

export function createChatStorage(opts: { backend: "local" | "twodrive"; dir: string; twoDriveUrl: string }): ChatStorage {
  return opts.backend === "twodrive" ? createTwoDriveStorage(opts.twoDriveUrl) : createLocalStorage(opts.dir);
}

function keyPath(root: string, full: string): string {
  return path.relative(root, full).split(path.sep).join("/");
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as string));
  return Buffer.concat(chunks);
}
