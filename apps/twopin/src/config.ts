import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/twopin"), // dev default (own db)
  /** Stable per-app key — delivered by the control plane at boot (twodb-core), never set by hand. */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6415"),
});

export type TwoPinConfig = z.infer<typeof configSchema>;

export function loadTwoPinConfig(source: Record<string, string | undefined> = process.env): TwoPinConfig {
  // Dev .env: TWOPIN_* wins over the shared vars (DATABASE_URL/PORT belong
  // to whichever app the shared block targets; docker installs inject plain
  // DATABASE_URL/PORT and no TWOPIN_*).
  return loadConfig(configSchema, {
    ...source,
    PORT: source.TWOPIN_PORT ?? source.PORT,
    DATABASE_URL: source.TWOPIN_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.TWOPIN_HTTP_URL ?? source.HTTP_URL,
  });
}
