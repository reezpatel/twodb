import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  PORT: z.coerce.number().int().positive().default(6411),
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/twodb"), // dev default (shared cluster)
  /** The unique per-app registration token TwoDB issued for this app at install time. */
  TWODB_PROVISION_TOKEN: z.string().default("dev-token"),
  HTTP_URL: z.string().url().default("http://localhost:6411"),
  /**
   * DEV ONLY: when set, requests that arrive WITHOUT gateway identity headers
   * are treated as this workspace. Lets you hit the backend directly
   * (curl / the webapp pointed straight at :6411) without booting TwoDB.
   * Never set this in a deployed container.
   */
  TWOTHING_DEV_WORKSPACE: z.string().optional(),
});

export type TwoThingConfig = z.infer<typeof configSchema>;

export function loadTwoThingConfig(source: Record<string, string | undefined> = process.env): TwoThingConfig {
  return loadConfig(configSchema, {
    ...source,
    PORT: source.TWOTHING_PORT ?? source.PORT,
    DATABASE_URL: source.TWOTHING_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.TWOTHING_HTTP_URL ?? source.HTTP_URL,
    TWODB_PROVISION_TOKEN: source.TWOTHING_PROVISION_TOKEN ?? source.TWODB_PROVISION_TOKEN,
  });
}
