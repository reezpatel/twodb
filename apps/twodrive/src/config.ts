import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/twodrive"), // dev default (own db)
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
  });
}
