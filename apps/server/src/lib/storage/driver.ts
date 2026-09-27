import { promises as fs } from "node:fs";
import path from "node:path";
import { DeleteObjectsCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// ---------------------------------------------------------------------------
// Storage drivers — every backend (S3 bucket or local path) implements this.
// Paths are backend-root-relative, `/`-separated, no leading slash. Org
// namespacing is applied by the caller (org files live under `<orgId>/…`).
// ---------------------------------------------------------------------------

export interface RawObject {
  path: string;
  size: number;
  etag?: string;
}

export interface StorageDriver {
  /** Lists all objects under a prefix, recursively (used by sync). */
  list(prefix: string): Promise<RawObject[]>;
  get(path: string): Promise<{ body: Buffer; contentType?: string }>;
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

// --- S3 / object -----------------------------------------------------------

export interface S3DriverConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function createS3Driver(config: S3DriverConfig): StorageDriver {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const bucket = config.bucket;

  return {
    async list(prefix) {
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
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: path }));
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) throw new Error("empty object");
      return { body: Buffer.from(bytes), contentType: res.ContentType };
    },

    async put(path, data, contentType) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: path, Body: data, ...(contentType ? { ContentType: contentType } : {}) }));
    },

    async del(path) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: [{ Key: path }] },
        }),
      );
    },

    async delPrefix(prefix) {
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
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    },
  };
}

// --- Local filesystem / block ----------------------------------------------

export interface LocalDriverConfig {
  rootPath: string;
}

export function createLocalDriver(config: LocalDriverConfig): StorageDriver {
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

    async put(rel: string, data: Buffer) {
      const target = abs(rel);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, data);
    },

    async del(rel: string) {
      await fs.rm(abs(rel), { force: true });
    },

    async delPrefix(prefix) {
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
