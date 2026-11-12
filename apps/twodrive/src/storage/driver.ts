import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Storage drivers — ported forward from the legacy monolith
// (archive/apps/server/src/lib/storage/driver.ts). Every backend (S3 bucket
// or local path) implements this. Paths are backend-root-relative,
// "/"-separated, no leading slash. Virtual-storage prefixes are applied by
// the caller (src/lib/store.ts), NOT by the driver.
// ---------------------------------------------------------------------------

export type NodeStream = Readable;

export interface RawObject {
  path: string;
  size: number;
  etag?: string;
}

export interface StorageDriver {
  /** Lists all objects under a prefix, recursively (used by rescan). */
  list(prefix: string): Promise<RawObject[]>;
  get(path: string): Promise<{ body: Buffer; contentType?: string }>;
  /** Streams an object without buffering it; range is [start, end] inclusive. */
  stream?(path: string, range?: { start: number; end: number }): Promise<NodeStream | null>;
  /** S3 drivers can hand out a time-limited direct URL, bypassing TwoDrive. */
  signedUrl?(path: string, options?: { expiresIn?: number; downloadName?: string }): Promise<string>;
  put(path: string, data: Buffer, contentType?: string): Promise<void>;
  del(path: string): Promise<void>;
  /** Recursively deletes everything under a prefix; returns deleted count. */
  delPrefix(prefix: string): Promise<number>;
  /** Block drivers create real directories. */
  mkdir?(path: string): Promise<void>;
  /** Throws if the backend is unreachable. */
  test(): Promise<void>;
}

/** Normalizes a relative path into safe segments; throws on traversal. */
export function pathSegments(rel: string): string[] {
  const segments = rel.split("/").filter((s) => s.length > 0);
  if (segments.some((s) => s === "." || s === ".." || s.includes("\\"))) {
    throw new Error("invalid path");
  }
  return segments;
}

export function joinPath(...parts: (string | undefined)[]): string {
  return parts.filter((p) => p && p.length > 0).join("/");
}

// --- S3 / object ------------------------------------------------------------

export interface S3DriverConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function createS3Driver(config: S3DriverConfig): StorageDriver {
  // Lazy client — @aws-sdk/client-s3 is an optional dependency (same pattern
  // as core-data/storage), only imported when an S3 backend actually exists.
  const clientPromise: Promise<import("@aws-sdk/client-s3").S3Client> = import("@aws-sdk/client-s3").then(
    ({ S3Client }) =>
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
  );
  const bucket = config.bucket;

  return {
    async list(prefix) {
      const client = await clientPromise;
      const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
      const out: RawObject[] = [];
      let token: string | undefined;
      do {
        const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
        for (const obj of res.Contents ?? []) {
          if (!obj.Key) continue;
          out.push({ path: obj.Key, size: Number(obj.Size ?? 0), etag: obj.ETag?.replace(/"/g, "") });
        }
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
      return out;
    },

    async get(path) {
      const client = await clientPromise;
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: path }));
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) throw new Error("empty object");
      return { body: Buffer.from(bytes), contentType: res.ContentType };
    },

    async stream(path, range) {
      const client = await clientPromise;
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const res = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: path, ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}) }),
      );
      // Newer @aws-sdk/client-s3 returns a Node Readable (ChecksumStream); older
      // builds return a web ReadableStream. Handle both.
      const body = res.Body as unknown;
      if (body instanceof Readable) return body as Readable;
      return Readable.fromWeb(body as never);
    },

    async signedUrl(path, options) {
      const client = await clientPromise;
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: path,
        ...(options?.downloadName ? { ResponseContentDisposition: `attachment; filename="${options.downloadName}"` } : {}),
      });
      return getSignedUrl(client, command, { expiresIn: options?.expiresIn ?? 900 });
    },

    async put(path, data, contentType) {
      const client = await clientPromise;
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: path, Body: data, ...(contentType ? { ContentType: contentType } : {}) }));
    },

    async del(path) {
      const client = await clientPromise;
      const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: [{ Key: path }] },
        }),
      );
    },

    async delPrefix(prefix) {
      const client = await clientPromise;
      const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
      const objects = await this.list(prefix);
      if (objects.length === 0) return 0;
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects.map((o) => ({ Key: o.path })) },
        }),
      );
      return objects.length;
    },

    async test() {
      const client = await clientPromise;
      const { HeadBucketCommand } = await import("@aws-sdk/client-s3");
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    },
  };
}

export function createLocalDriver(config: { rootPath: string }): StorageDriver {
  const root = path.resolve(config.rootPath);

  const abs = (rel: string) => {
    const target = path.resolve(root, ...pathSegments(rel));
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error("path escapes storage root");
    }
    return target;
  };

  return {
    async list(prefix) {
      const out: RawObject[] = [];
      const walk = async (dir: string, rel: string) => {
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const childRel = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) await walk(path.join(dir, entry.name), childRel);
          else if (entry.isFile()) {
            const stat = await fs.stat(path.join(dir, entry.name));
            out.push({ path: childRel, size: stat.size });
          }
        }
      };
      const start = abs(prefix);
      const rel = pathSegments(prefix).join("/");
      await walk(start, rel);
      return out;
    },

    async get(rel: string) {
      const body = await fs.readFile(abs(rel));
      return { body };
    },

    async stream(rel, range) {
      const target = abs(rel);
      const size = (await fs.stat(target)).size;
      const start = range?.start ?? 0;
      const end = Math.min(range?.end ?? size - 1, size - 1);
      if (start > end || start >= size) return null;
      return createReadStream(target, { start, end });
    },

    async put(rel: string, data: Buffer) {
      const target = abs(rel);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, data);
    },

    async del(rel: string) {
      await fs.rm(abs(rel), { force: true });
    },

    async delPrefix(prefix: string) {
      const target = abs(prefix);
      let count = 0;
      const countFiles = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (entry.isDirectory()) await countFiles(path.join(dir, entry.name));
          else count += 1;
        }
      };
      await countFiles(target);
      await fs.rm(target, { recursive: true, force: true });
      return count;
    },

    async mkdir(rel: string) {
      await fs.mkdir(abs(rel), { recursive: true });
    },

    async test() {
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) throw new Error("root path is not a directory");
    },
  };
}
