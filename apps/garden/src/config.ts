import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  PORT: z.coerce.number().int().positive().default(6410),
  DATABASE_URL: z.string().default("postgres://twodb:twodb@localhost:5432/twodb"),
  /** Stable per-app key — delivered by the control plane at boot (twodb-core), never set by hand. */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6410"),
  /** Max upload size for images/covers, bytes. */
  MAX_ASSET_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
});

export type GardenConfig = z.infer<typeof configSchema>;

export function loadGardenConfig(source: Record<string, string | undefined> = process.env): GardenConfig {
  // The shared dev .env holds other apps' PORT / DATABASE_URL; Garden's own GARDEN_* win.
  return loadConfig(configSchema, {
    ...source,
    PORT: source.GARDEN_PORT ?? source.PORT,
    DATABASE_URL: source.GARDEN_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.GARDEN_HTTP_URL ?? source.HTTP_URL,
  });
}
