import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url(),
  TWODB_PROVISION_TOKEN: z.string(),
  TWODB_HOST_ID: z.string().default("local"),
  HTTP_URL: z.string().url().default("http://localhost:4010"),
});

export type TwoRouteConfig = z.infer<typeof configSchema>;

export function loadTwoRouteConfig(): TwoRouteConfig {
  return loadConfig(configSchema);
}
