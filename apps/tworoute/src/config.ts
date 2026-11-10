import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/tworoute"), // dev default (own db)
  /** The unique per-app registration token TwoDB issued for this app at install time — see @twodb/core-platform/manifest's registerWithGateway(). */
  TWODB_PROVISION_TOKEN: z.string().default("dev-token"), // docker installs always inject a real one
  /**
   * Stable per-app encryption key injected by TwoDB's orchestrator (never
   * rotates, unlike the registration token) — keys the AES-256-GCM
   * encryption of provider API keys at rest. Optional so dev mode can fall
   * back to the registration token; production containers always get one.
   */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6400"),
});

export type TwoRouteConfig = z.infer<typeof configSchema>;

export function loadTwoRouteConfig(): TwoRouteConfig {
  return loadConfig(configSchema);
}
