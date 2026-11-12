import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  PORT: z.coerce.number().int().positive().default(6414),
  DATABASE_URL: z.string().default("postgres://twodb:twodb@localhost:5432/twodb"),
  TWODB_PROVISION_TOKEN: z.string().default("dev-token"),
  HTTP_URL: z.string().url().default("http://localhost:6414"),
  /** Blob storage: "s3" (MinIO bucket from the db compose) or "local" (dev fallback). */
  STORAGE: z.enum(["s3", "local"]).default("local"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_BUCKET: z.string().default("twodb"),
  S3_ACCESS_KEY_ID: z.string().default("twodb"),
  S3_SECRET_ACCESS_KEY: z.string().default("twodb-secret"),
  LOCAL_STORAGE_DIR: z.string().default("./.data/blobs"),
});

export type PaintressConfig = z.infer<typeof configSchema>;

export function loadPaintressConfig(source: Record<string, string | undefined> = process.env): PaintressConfig {
  // The shared dev .env holds other apps' PORT / DATABASE_URL; Paintress' own PAINTRESS_* win.
  // (Docker installs inject plain PORT / DATABASE_URL, which are used when no PAINTRESS_* is set.)
  return loadConfig(configSchema, {
    ...source,
    PORT: source.PAINTRESS_PORT ?? source.PORT,
    DATABASE_URL: source.PAINTRESS_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.PAINTRESS_HTTP_URL ?? source.HTTP_URL,
    TWODB_PROVISION_TOKEN: source.PAINTRESS_PROVISION_TOKEN ?? source.TWODB_PROVISION_TOKEN,
  });
}