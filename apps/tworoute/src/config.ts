import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url(),
  /** The unique per-app registration token TwoDB issued for this app at install time — see @twodb/core-platform/manifest's registerWithGateway(). */
  TWODB_PROVISION_TOKEN: z.string(),
  HTTP_URL: z.string().url().default("http://localhost:4010"),
});

export type TwoRouteConfig = z.infer<typeof configSchema>;

export function loadTwoRouteConfig(): TwoRouteConfig {
  return loadConfig(configSchema);
}
