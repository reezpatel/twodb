import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://app_dispatch:dispatch@localhost:5432/twodb"),
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6408"),
});

export type DispatchConfig = z.infer<typeof configSchema>;

export function loadDispatchConfig(source: Record<string, string | undefined> = process.env): DispatchConfig {
  // The shared dev .env holds other apps' PORT / DATABASE_URL; Dispatch's own
  // DISPATCH_* vars win. (Docker installs inject plain PORT / DATABASE_URL,
  // which are used when no DISPATCH_* is set.)
  return loadConfig(configSchema, {
    ...source,
    PORT: source.DISPATCH_PORT ?? source.PORT,
    DATABASE_URL: source.DISPATCH_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.DISPATCH_HTTP_URL ?? source.HTTP_URL,
  });
}
