import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/twodrive"), // dev default (own db)
  /** The unique per-app registration token TwoDB issued for this app at install time — see @twodb/core-platform/manifest's registerWithGateway(). */
  TWODB_PROVISION_TOKEN: z.string().default("dev-token"), // docker installs always inject a real one
  /** Stable per-app encryption key injected by TwoDB's orchestrator (never rotates) — keys AES-256-GCM secrets at rest. */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6406"),
});

export type TwoDriveConfig = z.infer<typeof configSchema>;

export function loadTwoDriveConfig(source: Record<string, string | undefined> = process.env): TwoDriveConfig {
  return loadConfig(configSchema, {
    ...source,
    PORT: source.TWODRIVE_PORT ?? source.PORT,
    DATABASE_URL: source.TWODRIVE_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.TWODRIVE_HTTP_URL ?? source.HTTP_URL,
    TWODB_PROVISION_TOKEN: source.TWODRIVE_PROVISION_TOKEN ?? source.TWODB_PROVISION_TOKEN,
  });
}
