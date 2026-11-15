import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/toolkit"), // dev default (own db)
  /** Stable per-app key — delivered by the control plane at boot (twodb-core), never set by hand. */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6418"),
});

export type ToolkitConfig = z.infer<typeof configSchema>;

export function loadToolkitConfig(source: Record<string, string | undefined> = process.env): ToolkitConfig {
  // Dev .env: TOOLKIT_* wins over the shared vars (DATABASE_URL/PORT belong
  // to whichever app the shared block targets; docker installs inject plain
  // DATABASE_URL/PORT and no TOOLKIT_*).
  return loadConfig(configSchema, {
    ...source,
    PORT: source.TOOLKIT_PORT ?? source.PORT,
    DATABASE_URL: source.TOOLKIT_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.TOOLKIT_HTTP_URL ?? source.HTTP_URL,
  });
}
