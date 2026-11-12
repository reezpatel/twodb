import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  PORT: z.coerce.number().int().positive().default(6414),
  DATABASE_URL: z.string().default("postgres://twodb:twodb@localhost:5432/twodb"),
  /** Stable per-app key — delivered by the control plane at boot (twodb-core), never set by hand. */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6414"),
  /** Local blob dir — only used when the control plane has no S3 configured (TWODB_S3_* on TwoDB). */
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
  });
}