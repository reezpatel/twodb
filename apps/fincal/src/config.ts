import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/fincal"),
  /** Stable per-app key — delivered by the control plane at boot (twodb-core), never set by hand. */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6419"),
});

export type FincalConfig = z.infer<typeof configSchema>;

export function loadFincalConfig(source: Record<string, string | undefined> = process.env): FincalConfig {
  return loadConfig(configSchema, {
    ...source,
    PORT: source.FINCAL_PORT ?? source.PORT ?? "6419",
    DATABASE_URL: source.FINCAL_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.FINCAL_HTTP_URL ?? source.HTTP_URL,
  });
}
