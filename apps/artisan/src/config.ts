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
  TWOROUTE_URL: z.string().url().default("http://localhost:6400/apps/tworoute"),
  /** Dispatch — runners + exec/jobs. Reached through the gateway. */
  DISPATCH_URL: z.string().url().default("http://localhost:6400/apps/dispatch"),
});

export type ArtisanConfig = z.infer<typeof configSchema>;

export function loadArtisanConfig(): ArtisanConfig {
  return loadConfig(configSchema);
}
