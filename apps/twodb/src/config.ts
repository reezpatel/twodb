import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  /** TwoDB's own control-plane store — bootstrapped on first run, no setup required. */
  TWODB_SQLITE_FILE: z.string().default("./.data/twodb-control-plane.sqlite"),
  /** Admin connection to the shared Postgres cluster, used only for provisioning other apps' schemas/roles. */
  TWODB_PG_ADMIN_URL: z.string().url(),
  AUTH_SECRET: z.string().min(16),
  AUTH_BASE_URL: z.string().url().default("http://localhost:4000"),
  AUTH_TRUSTED_ORIGINS: z.string().default("http://localhost:5173").transform((v) => v.split(",")),
  PASSKEY_RP_ID: z.string().default("localhost"),
  PASSKEY_ORIGIN: z.string().url().default("http://localhost:5173"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  POCKETID_ISSUER: z.string().url().optional(),
  POCKETID_CLIENT_ID: z.string().optional(),
  POCKETID_CLIENT_SECRET: z.string().optional(),
});

export type TwoDbConfig = z.infer<typeof configSchema>;

export function loadTwoDbConfig(): TwoDbConfig {
  return loadConfig(configSchema);
}
