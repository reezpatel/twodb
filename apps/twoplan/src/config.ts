import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/twoplan"),
  /** Stable per-app key — delivered by the control plane at boot (twodb-core), never set by hand. */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6417"),
  /** Root dir for attachment blobs (local storage adapter). */
  TWOPLAN_BLOB_DIR: z.string().default(".data/twoplan/blobs"),
});

export type TwoPlanConfig = z.infer<typeof configSchema>;

export function loadTwoPlanConfig(source: Record<string, string | undefined> = process.env): TwoPlanConfig {
  return loadConfig(configSchema, {
    ...source,
    PORT: source.TWOPLAN_PORT ?? source.PORT ?? "6417",
    DATABASE_URL: source.TWOPLAN_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.TWOPLAN_HTTP_URL ?? source.HTTP_URL,
  });
}
