import { z } from "zod";
import { loadConfig, commonConfigFields } from "@twodb/core-data/config";

export const configSchema = z.object({
  ...commonConfigFields,
  /**
   * TwoDB's own listen port — PORT by default (the NixOS module and Docker
   * set PORT), but in dev the shared root .env's PORT belongs to TwoRoute
   * (every app loads the same file), so TWODB_PORT takes precedence there.
   */
  TWODB_PORT: z.coerce.number().int().positive().optional(),
  PORT: z.coerce.number().int().positive().default(6400),
  /** TwoDB's own control-plane store — bootstrapped on first run, no setup required. */
  TWODB_SQLITE_FILE: z.string().default("./.data/twodb-control-plane.sqlite"),
  /** Admin connection to the shared Postgres cluster, used only for provisioning other apps' schemas/roles. */
  TWODB_PG_ADMIN_URL: z.string().url().default("postgres://twodb:twodb@localhost:5432/twodb"), // dev default — set explicitly in production
  /** Hostname installed-app containers use to reach Postgres — "localhost" (TwoDB's own view) is never reachable from inside a container. Defaults to the service name docker-compose.db.yaml gives the Postgres container. */
  TWODB_PG_CONTAINER_HOST: z.string().default("twodb-postgres"),
  AUTH_SECRET: z.string().min(16).default("dev-only-secret-change-me-0000"), // dev default — MUST be set in production
  AUTH_BASE_URL: z.string().url().default("http://localhost:6400"),
  AUTH_TRUSTED_ORIGINS: z.string().default("http://localhost:6500").transform((v) => v.split(",")),
  PASSKEY_RP_ID: z.string().default("localhost"),
  PASSKEY_ORIGIN: z.string().url().default("http://localhost:6500"),
  /** What TwoDB injects as `TWODB_GATEWAY_URL` into installed-app containers — "localhost" from TwoDB's own perspective is not reachable from inside a container when TwoDB itself runs on the host. */
  TWODB_GATEWAY_URL_FOR_CONTAINERS: z.string().url().default("http://host.docker.internal:6400"),
  /**
   * If set (e.g. `ghcr.io/youruser`), installs/upgrades pull app images
   * (`<registry>/app-<slug>:<version ?? "latest">`) instead of building
   * them locally from the workspace checkout. These are the images CI
   * releases from repo-wide `vX.Y.Z` tags (see
   * .github/workflows/release-app.yml). Leave unset for the monorepo dev
   * default.
   */
  TWODB_APP_IMAGE_REGISTRY: z.string().optional(),
  /**
   * What gets injected as the app's own HTTP_URL (what it tells the Gateway
   * to proxy to). Placeholders: {slug}, {hostPort}, {containerPort}.
   * Default works when TwoDB runs ON the host. When TwoDB itself runs as a
   * container on twodb-net, use e.g. "http://twodb-app-{slug}:{containerPort}"
   * and set TWODB_APP_PUBLISH_PORTS=false — localhost inside TwoDB's
   * container is TwoDB itself, not the app.
   */
  TWODB_APP_HTTP_URL_TEMPLATE: z.string().default("http://localhost:{hostPort}"),
  /** Publish each app's containerPort on the host. Disable when TwoDB is containerized and talks to apps over the shared docker network by container name. */
  TWODB_APP_PUBLISH_PORTS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  TWODB_HOST_ID: z.string().default("local"),
  /**
   * Shared secret every app presents (header `x-twodb-registration-secret`)
   * to self-register and mint a 30-day app token. Unset = app-initiated
   * registration by secret is disabled (managed installs still work: TwoDB
   * mints a non-expiring token for the container itself).
   */
  TWODB_REGISTRATION_SECRET: z.string().min(16).optional(),
  /** Lifetime of a token minted through the registration-secret / API path. */
  TWODB_APP_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** An app that hasn't pinged for this long is marked inactive (apps ping every 10s). */
  TWODB_HEARTBEAT_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /**
   * Global S3-compatible storage, configured like the Postgres cluster: one
   * bucket + credentials for the whole install; every app gets its own key
   * prefix (`<slug>/`). All optional — unset = apps get no `s3` config.
   */
  TWODB_S3_BUCKET: z.string().optional(),
  TWODB_S3_REGION: z.string().optional(),
  TWODB_S3_ENDPOINT: z.string().url().optional(),
  TWODB_S3_ACCESS_KEY_ID: z.string().optional(),
  TWODB_S3_SECRET_ACCESS_KEY: z.string().optional(),
  TWODB_S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? undefined : v === "true")),
  /**
   * Passkey sign-up policy. Default (false): only the very first user can
   * register (first-run bootstrap); afterwards adding a passkey needs a
   * session. true: anyone may sign up with a new email (new users get a
   * personal workspace). An email that already has a passkey can never be
   * re-registered without a session.
   */
  /**
   * Extra origins allowed as "Login with TwoDB" redirect targets (app webapps), comma-separated.
   * Implicitly allowed: AUTH_TRUSTED_ORIGINS, and any port 6500-6599 on the same host as one of
   * them (the dev webapp band — see orchestrator/catalog.ts).
   */
  TWODB_LOGIN_REDIRECT_ORIGINS: z.string().default("").transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  /** Lifetime of the session issued to an app webapp by the login flow, in days. */
  TWODB_APP_SESSION_DAYS: z.coerce.number().int().positive().default(7),
  TWODB_OPEN_SIGNUP: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
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
