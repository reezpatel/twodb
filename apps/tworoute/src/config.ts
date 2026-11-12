import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/tworoute"), // dev default (own db)
  /**
   * Stable per-app encryption key injected by TwoDB's orchestrator (never
   * rotates, unlike the registration token) — keys the AES-256-GCM
   * encryption of provider API keys at rest. Optional so dev mode can fall
   * back to the registration token; production containers always get one.
   */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6401"),
});

export type TwoRouteConfig = z.infer<typeof configSchema>;

export function loadTwoRouteConfig(source: Record<string, string | undefined> = process.env): TwoRouteConfig {
  // Dev .env: TWOROUTE_* wins over the shared vars (DATABASE_URL/PORT belong
  // to whichever app the shared block targets; docker installs inject plain
  // DATABASE_URL/PORT and no TWOROUTE_*).
  return loadConfig(configSchema, {
    ...source,
    PORT: source.TWOROUTE_PORT ?? source.PORT,
    DATABASE_URL: source.TWOROUTE_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.TWOROUTE_HTTP_URL ?? source.HTTP_URL,
  });
}
