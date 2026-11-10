import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  /** TwoDB's own control-plane store — bootstrapped on first run, no setup required. */
  TWODB_SQLITE_FILE: z.string().default("./.data/twodb-control-plane.sqlite"),
  /** Admin connection to the shared Postgres cluster, used only for provisioning other apps' schemas/roles. */
  TWODB_PG_ADMIN_URL: z.string().url(),
  /** Hostname installed-app containers use to reach Postgres — "localhost" (TwoDB's own view) is never reachable from inside a container. Defaults to the service name docker-compose.db.yaml gives the Postgres container. */
  TWODB_PG_CONTAINER_HOST: z.string().default("twodb-postgres"),
  AUTH_SECRET: z.string().min(16),
  AUTH_BASE_URL: z.string().url().default("http://localhost:4000"),
  AUTH_TRUSTED_ORIGINS: z.string().default("http://localhost:5173").transform((v) => v.split(",")),
  PASSKEY_RP_ID: z.string().default("localhost"),
  PASSKEY_ORIGIN: z.string().url().default("http://localhost:5173"),
  /** What TwoDB injects as `TWODB_GATEWAY_URL` into installed-app containers — "localhost" from TwoDB's own perspective is not reachable from inside a container when TwoDB itself runs on the host. */
  TWODB_GATEWAY_URL_FOR_CONTAINERS: z.string().url().default("http://host.docker.internal:4000"),
  /**
   * If set (e.g. `ghcr.io/youruser`), installs/upgrades pull app images
   * (`<registry>/app-<slug>:<version ?? "latest">`) instead of building
   * them locally from the workspace checkout. These are the images CI
   * releases from repo-wide `vX.Y.Z` tags (see
   * .github/workflows/release-app.yml). Leave unset for the monorepo dev
   * default.
   */
  TWODB_APP_IMAGE_REGISTRY: z.string().optional(),
  TWODB_HOST_ID: z.string().default("local"),
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
