import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://app_dispatch:dispatch@localhost:5432/twodb"),
  TWODB_PROVISION_TOKEN: z.string().default("dev-token"),
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6408"),
});

export type DispatchConfig = z.infer<typeof configSchema>;

export function loadDispatchConfig(): DispatchConfig {
  return loadConfig(configSchema);
}
