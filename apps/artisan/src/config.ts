import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://app_artisan:artisan@localhost:5432/twodb"),
  TWODB_PROVISION_TOKEN: z.string().default("dev-token"),
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6407"),
  ARTISAN_DEFAULT_MODEL: z.string().optional(),
  /** TwoRoute — models + LLM calls. */
  TWOROUTE_URL: z.string().url().default("http://localhost:6401/apps/tworoute"),
  /** Dispatch — runners + exec/jobs. Reached through the gateway. */
  DISPATCH_URL: z.string().url().default("http://localhost:6400/apps/dispatch"),
});

export type ArtisanConfig = z.infer<typeof configSchema>;

export function loadArtisanConfig(source: Record<string, string | undefined> = process.env): ArtisanConfig {
  // The shared dev .env holds other apps' PORT / DATABASE_URL; Artisan's own
  // ARTISAN_* vars win. (Docker installs inject plain PORT / DATABASE_URL,
  // which are used when no ARTISAN_* is set.)
  return loadConfig(configSchema, {
    ...source,
    PORT: source.ARTISAN_PORT ?? source.PORT,
    DATABASE_URL: source.ARTISAN_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.ARTISAN_HTTP_URL ?? source.HTTP_URL,
  });
}
