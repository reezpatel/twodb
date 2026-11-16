import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/twopager"),
  /** Stable per-app key — delivered by the control plane at boot (twodb-core), never set by hand. */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6420"),
  /** Blob fallback when the control plane has no S3 configured (dev). */
  LOCAL_STORAGE_DIR: z.string().default("./.data/blobs"),
  /** Local read-through cache of site files (served from here, filled from S3 on first hit). */
  CACHE_DIR: z.string().default("./.data/cache"),
  CACHE_MAX_MB: z.coerce.number().int().positive().default(2048),
  /**
   * Hosts that show the TwoPager admin UI instead of a site (comma separated), e.g. `twopager.example.com`.
   * Always admin: localhost, IP addresses and single-label hosts (docker-internal names).
   */
  ADMIN_HOSTS: z.string().default(""),
  /** Optional wildcard base for built-in site hostnames: `<site-slug>.<SITES_DOMAIN>`. Must NOT be under ROOT_DOMAIN. */
  SITES_DOMAIN: z.string().optional(),
  MAX_ZIP_MB: z.coerce.number().int().positive().default(1024),
  MAX_FILE_MB: z.coerce.number().int().positive().default(512),
  MAX_FILES: z.coerce.number().int().positive().default(5000),
});

export type TwoPagerConfig = z.infer<typeof configSchema>;

export function loadTwoPagerConfig(source: Record<string, string | undefined> = process.env): TwoPagerConfig {
  const pick = (k: string) => source[`TWOPAGER_${k}`] ?? source[k];
  return loadConfig(configSchema, {
    ...source,
    PORT: source.TWOPAGER_PORT ?? source.PORT ?? "6420",
    DATABASE_URL: source.TWOPAGER_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.TWOPAGER_HTTP_URL ?? source.HTTP_URL,
    LOCAL_STORAGE_DIR: pick("LOCAL_STORAGE_DIR"),
    CACHE_DIR: pick("CACHE_DIR"),
    CACHE_MAX_MB: pick("CACHE_MAX_MB"),
    ADMIN_HOSTS: pick("ADMIN_HOSTS"),
    SITES_DOMAIN: pick("SITES_DOMAIN"),
    MAX_ZIP_MB: pick("MAX_ZIP_MB"),
    MAX_FILE_MB: pick("MAX_FILE_MB"),
    MAX_FILES: pick("MAX_FILES"),
  });
}
