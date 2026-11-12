import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/twopin"), // dev default (own db)
  /** The unique per-app registration token TwoDB issued for this app at install time — see @twodb/core-platform/manifest's registerWithGateway(). */
  TWODB_PROVISION_TOKEN: z.string().default("dev-token"), // docker installs always inject a real one
  HTTP_URL: z.string().url().default("http://localhost:6415"),
});

export type TwoPinConfig = z.infer<typeof configSchema>;

export function loadTwoPinConfig(source: Record<string, string | undefined> = process.env): TwoPinConfig {
  // Dev .env: TWOPIN_* wins over the shared vars (DATABASE_URL/PORT belong
  // to whichever app the shared block targets; docker installs inject plain
  // DATABASE_URL/PORT/TWODB_PROVISION_TOKEN and no TWOPIN_*).
  return loadConfig(configSchema, {
    ...source,
    PORT: source.TWOPIN_PORT ?? source.PORT,
    DATABASE_URL: source.TWOPIN_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.TWOPIN_HTTP_URL ?? source.HTTP_URL,
    TWODB_PROVISION_TOKEN: source.TWOPIN_PROVISION_TOKEN ?? source.TWODB_PROVISION_TOKEN,
  });
}
