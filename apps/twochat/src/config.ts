import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  DATABASE_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/twochat"), // dev default (own schema on the shared cluster)
  /** The unique per-app registration token TwoDB issued for this app at install time — see @twodb/core-platform/manifest's registerWithGateway(). */
  TWODB_PROVISION_TOKEN: z.string().default("dev-token"), // docker installs always inject a real one
  /**
   * Stable per-app encryption key injected by TwoDB's orchestrator. Optional
   * so dev mode can fall back to the registration token.
   */
  TWODB_DATA_KEY: z.string().optional(),
  HTTP_URL: z.string().url().default("http://localhost:6405"),
  /**
   * Blob storage for message attachments. "twodrive" routes through TwoDrive's
   * S3 API (in development — stubbed client until it ships), "local" writes to
   * a local dir (dev default, zero deps). Same StorageAdapter interface either way.
   */
  TWOCHAT_STORAGE_BACKEND: z.enum(["local", "twodrive"]).default("local"),
  TWOCHAT_STORAGE_DIR: z.string().default("./.data/twochat/blobs"),
  /** TwoDrive S3 base URL (its gateway path) — only read when backend=twodrive. */
  TWOCHAT_TWODRIVE_URL: z.string().default("http://localhost:6400/apps/twodrive"),
  /** Max attachment size (bytes) — 25MB, Slack-ish. */
  TWOCHAT_MAX_ATTACHMENT_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
});

export type TwoChatConfig = z.infer<typeof configSchema>;

export function loadTwoChatConfig(source: Record<string, string | undefined> = process.env): TwoChatConfig {
  // Dev .env: TWOCHAT_* wins over the shared vars (DATABASE_URL/PORT belong
  // to whichever app the shared block targets; docker installs inject plain
  // DATABASE_URL/PORT/TWODB_PROVISION_TOKEN and no TWOCHAT_*).
  return loadConfig(configSchema, {
    ...source,
    PORT: source.TWOCHAT_PORT ?? source.PORT,
    DATABASE_URL: source.TWOCHAT_DATABASE_URL ?? source.DATABASE_URL,
    HTTP_URL: source.TWOCHAT_HTTP_URL ?? source.HTTP_URL,
    TWODB_PROVISION_TOKEN: source.TWOCHAT_PROVISION_TOKEN ?? source.TWODB_PROVISION_TOKEN,
  });
}
