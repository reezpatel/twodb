// @twodb/core-data/storage
//
// Minimal blob storage abstraction used by any app that stores files
// (TwoMail attachments, TwoDrive, Garden embeds, etc). Two backends ship
// today: local filesystem (default, zero external deps) and an
// S3-compatible backend (optional dependency, loaded lazily).

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";

export interface PutOptions {
  contentType?: string;
}

export interface StorageObject {
  key: string;
  size: number;
  contentType?: string;
}

export interface StorageAdapter {
  put(key: string, data: Buffer | Readable, opts?: PutOptions): Promise<StorageObject>;
  get(key: string): Promise<Buffer>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<StorageObject[]>;
  /** Not every backend can issue a signed URL (local fs cannot without a serving route). */
  getSignedUrl?(key: string, expiresInSeconds?: number): Promise<string>;
}

export interface LocalStorageOptions {
  /** Root directory on disk. One per app, e.g. `/var/lib/twodb/<app>/blobs`. */
  rootDir: string;
}

export function createLocalStorage(options: LocalStorageOptions): StorageAdapter {
  const root = options.rootDir;

  function resolveSafe(key: string): string {
    const full = path.normalize(path.join(root, key));
    if (!full.startsWith(path.normalize(root))) {
      throw new Error(`storage: key escapes root dir: ${key}`);
    }
    return full;
  }

  return {
    async put(key, data, opts) {
      const full = resolveSafe(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      const buf = Buffer.isBuffer(data) ? data : await streamToBuffer(data);
      await fs.writeFile(full, buf);
      if (opts?.contentType) {
        await fs.writeFile(`${full}.contenttype`, opts.contentType, "utf8");
      }
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
      const out: StorageObject[] = [];
      for (const entry of entries) {
        if (entry.endsWith(".contenttype")) continue;
        const full = path.join(dir, entry);
        const stat = await fs.stat(full);
        if (stat.isFile()) {
          out.push({ key: path.posix.join(prefix, entry), size: stat.size });
        }
      }
      return out;
    },
  };
}

export interface S3StorageOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

/**
 * S3-compatible backend (AWS S3, MinIO, R2, etc). `@aws-sdk/client-s3` is an
 * optional dependency and only required at runtime if this factory is
 * actually called.
 */
export async function createS3Storage(options: S3StorageOptions): Promise<StorageAdapter> {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } =
    await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = new S3Client({
    region: options.region ?? "auto",
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
    credentials: options.credentials,
  });

  return {
    async put(key, data, opts) {
      const buf = Buffer.isBuffer(data) ? data : await streamToBuffer(data);
      await client.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: key,
          Body: buf,
          ContentType: opts?.contentType,
        }),
      );
      return { key, size: buf.length, contentType: opts?.contentType };
    },
    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: options.bucket, Key: key }));
      return streamToBuffer(res.Body as Readable);
    },
    async getStream(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: options.bucket, Key: key }));
      return res.Body as Readable;
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key }));
    },
    async list(prefix) {
      const res = await client.send(
        new ListObjectsV2Command({ Bucket: options.bucket, Prefix: prefix }),
      );
      return (res.Contents ?? []).map((o) => ({ key: o.Key!, size: o.Size ?? 0 }));
    },
    async getSignedUrl(key, expiresInSeconds = 3600) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: options.bucket, Key: key }), {
        expiresIn: expiresInSeconds,
      });
    },
  };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
