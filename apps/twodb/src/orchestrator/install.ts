import * as path from "node:path";
import * as fs from "node:fs";
import { randomBytes } from "node:crypto";
import type { RegistryRepo } from "../db/registry.js";
import type { TwoDbConfig } from "../config.js";
import { getCatalogEntry, type CatalogEntry } from "./catalog.js";
import { generateAppToken } from "./tokens.js";
import { provisionAppDatabase, encryptSecret, decryptSecret } from "../db/provisioning.js";
import * as docker from "./docker.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../");
const DOCKERFILE = path.join(REPO_ROOT, "deploy/docker/app.Dockerfile");

function containerName(slug: string): string {
  return `twodb-app-${slug}`;
}

/** The version stamped on a locally-built image, read from the app's own package.json — the workspace is the source of truth. */
function workspaceVersion(entry: CatalogEntry): string {
  const pkgPath = path.join(REPO_ROOT, "apps", entry.slug, "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function localImageRef(entry: CatalogEntry, version: string): string {
  return `twodb/${entry.slug}:${version}`;
}

function registryImageRef(config: TwoDbConfig, entry: CatalogEntry, version: string): string {
  return `${config.TWODB_APP_IMAGE_REGISTRY}/app-${entry.slug}:${version}`;
}

export interface InstallOptions {
  registry: RegistryRepo;
  config: TwoDbConfig;
}

/**
 * Mints the token a TwoDB-managed container uses to talk to the control
 * plane: non-expiring (`expires_at` null), rotated on every (re)install —
 * previous managed tokens are revoked. Plaintext is returned once (it goes
 * straight into the container env); only the hash is stored.
 */
export async function issueManagedToken(slug: string, opts: InstallOptions): Promise<{ appToken: string }> {
  const entry = getCatalogEntry(slug);
  if (!entry) throw new Error(`"${slug}" is not in the app catalog`);

  await opts.registry.beginInstall({
    slug: entry.slug,
    name: entry.name,
    version: workspaceVersion(entry),
    shape: "backend",
    basePath: `/apps/${entry.slug}`,
    hostId: "docker",
    capabilities: [],
  });
  await opts.registry.revokeTokens(slug, "managed");
  const appToken = generateAppToken();
  await opts.registry.issueToken(slug, "managed", appToken, null);
  return { appToken };
}

/**
 * Mints an expiring (TWODB_APP_TOKEN_TTL_DAYS, default 30) token for any
 * slug — the API/dev path for apps TwoDB does NOT run. Same token the
 * `POST /registry/register` secret flow hands out.
 */
export async function issueApiToken(slug: string, opts: InstallOptions): Promise<{ appToken: string; expiresAt: string | null }> {
  const appToken = generateAppToken();
  const { expiresAt } = await opts.registry.issueToken(slug, "api", appToken, apiTokenTtlMs(opts.config));
  return { appToken, expiresAt };
}

export function apiTokenTtlMs(config: TwoDbConfig): number {
  return config.TWODB_APP_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Creates (or re-reads, for a slug already provisioned) the app's Postgres
 * schema+role, and ensures the app has a stable data key (generated once,
 * reused forever — apps use it to encrypt their own data at rest, so it
 * must survive token rotation on upgrades). Returns connection strings and
 * the data key exactly once per call — plain for a developer's local
 * `.env` (admin's own view of the host), container-reachable for Docker.
 * Only the container forms are persisted (encrypted), since that's what
 * `upgradeApp`/`restartApp` need again.
 */
export async function provisionDatabase(slug: string, opts: InstallOptions, { rotate = false }: { rotate?: boolean } = {}) {
  // Reuse the stored role password — registering/fetching config must never
  // change credentials. Only an explicit rotate (or an undecryptable store) does.
  const current = await opts.registry.getApp(slug);
  let existingPassword: string | undefined;
  if (current?.pg_connection_string_encrypted) {
    try {
      existingPassword = decodeURIComponent(new URL(decryptSecret(current.pg_connection_string_encrypted, opts.config.AUTH_SECRET)).password);
    } catch {
      existingPassword = undefined; // unrecoverable -> heal by resetting once
    }
  }
  const provisioned = await provisionAppDatabase(
    opts.config.TWODB_PG_ADMIN_URL,
    slug,
    opts.config.TWODB_PG_CONTAINER_HOST,
    { existingPassword, rotate },
  );
  const encrypted = encryptSecret(provisioned.containerConnectionString, opts.config.AUTH_SECRET);
  await opts.registry.setProvisioning(slug, provisioned.schema, provisioned.role, encrypted);

  const dataKey = current?.data_key_encrypted
    ? decryptSecret(current.data_key_encrypted, opts.config.AUTH_SECRET)
    : randomBytes(32).toString("hex");
  if (!current?.data_key_encrypted) {
    await opts.registry.setDataKey(slug, encryptSecret(dataKey, opts.config.AUTH_SECRET));
  }

  return {
    schema: provisioned.schema,
    role: provisioned.role,
    connectionString: provisioned.connectionString,
    containerConnectionString: provisioned.containerConnectionString,
    dataKey,
  };
}

function appHttpUrl(config: TwoDbConfig, entry: CatalogEntry): string {
  return config.TWODB_APP_HTTP_URL_TEMPLATE.replaceAll("{slug}", entry.slug)
    .replaceAll("{hostPort}", String(entry.hostPort))
    .replaceAll("{containerPort}", String(entry.containerPort));
}

function buildContainerEnv(entry: CatalogEntry, config: TwoDbConfig, appToken: string) {
  // Deliberately NO DATABASE_URL / S3 / data key here: the app presents its
  // token to the control plane (twodb-core -> GET /registry/config) and gets
  // its Postgres + S3 config (and stable data key) back at boot.
  return {
    NODE_ENV: "production",
    PORT: String(entry.containerPort),
    TWODB_GATEWAY_URL: config.TWODB_GATEWAY_URL_FOR_CONTAINERS,
    // The app's identity: it registers + pings with this and sends it as
    // x-twodb-token on gateway calls. Non-expiring, rotated on (re)install
    // or from the UI.
    TWODB_APP_SLUG: entry.slug,
    TWODB_APP_TOKEN: appToken,
    TWODB_HOST_ID: "docker",
    // What the app tells TwoDB its reachable URL is at registration time —
    // the gateway proxies to this. See TWODB_APP_HTTP_URL_TEMPLATE.
    HTTP_URL: appHttpUrl(config, entry),
  };
}

/**
 * Registration is always app-initiated now (the app registers/pings the
 * gateway with its token). After starting a container the orchestrator just
 * waits for that to happen: status "active" with a heartbeat newer than
 * `since`. Throws if the app never shows up (runLifecycle records "failed").
 */
async function waitForRegistration(
  entry: CatalogEntry,
  since: number,
  opts: InstallOptions,
  { attempts = 90, intervalMs = 2000 }: { attempts?: number; intervalMs?: number } = {},
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const row = await opts.registry.getApp(entry.slug);
    if (row?.status === "active" && row.last_seen_at && Date.parse(row.last_seen_at) >= since) {
      await opts.registry.setInstallStatus(entry.slug, "running");
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`app "${entry.slug}" never registered with the gateway after ${attempts * intervalMs / 1000}s`);
}

/**
 * Resolves the image ref to install, honoring TWODB_APP_IMAGE_REGISTRY:
 * - registry configured -> pull `registry/app-<slug>:<version ?? "latest">`
 *   (images released by CI from repo-wide `vX.Y.Z` tags — see
 *   .github/workflows/release-app.yml);
 * - not configured (the monorepo dev default) -> build locally from the
 *   workspace checkout and tag `twodb/<slug>:<package.json version>` (the
 *   package.json version only labels local builds; release versions come
 *   from the git tag).
 * Returns the ref actually used and the version it was stamped with.
 */
async function resolveImage(
  entry: CatalogEntry,
  opts: InstallOptions,
  requestedVersion?: string,
): Promise<{ ref: string; version: string }> {
  if (opts.config.TWODB_APP_IMAGE_REGISTRY) {
    const version = requestedVersion ?? "latest";
    const ref = registryImageRef(opts.config, entry, version);
    await docker.pullImage(ref);
    return { ref, version };
  }

  const version = requestedVersion ?? workspaceVersion(entry);
  const ref = localImageRef(entry, version);
  await docker.buildImage({ repoRoot: REPO_ROOT, dockerfile: DOCKERFILE, pkgName: entry.pkgName, tag: ref });
  return { ref, version };
}

/**
 * Full, one-click install: issues a token, provisions the DB, resolves the
 * image (registry pull or local build), and starts the container. TwoDB
 * then waits for the app to register itself (token + ping) —
 * `install_status` goes "installing" -> "running" once it does. Poll `GET /orchestrator/apps/:slug/status`.
 */
export async function installApp(slug: string, opts: InstallOptions, requestedVersion?: string): Promise<void> {
  const entry = getCatalogEntry(slug);
  if (!entry) throw new Error(`"${slug}" is not in the app catalog`);

  const { appToken } = await issueManagedToken(slug, opts);
  const startedAt = Date.now();
  await provisionDatabase(slug, opts); // schema + role (credentials are delivered to the app by the control plane at boot)

  const { ref, version } = await resolveImage(entry, opts, requestedVersion);

  const name = containerName(entry.slug);
  await docker.runContainer({
    name,
    image: ref,
    env: buildContainerEnv(entry, opts.config, appToken),
    hostPort: entry.hostPort,
    containerPort: entry.containerPort,
    publish: opts.config.TWODB_APP_PUBLISH_PORTS,
  });
  await opts.registry.setContainerInfo(entry.slug, { imageTag: ref, containerName: name, hostPort: entry.hostPort });
  await opts.registry.setVersion(entry.slug, version);

  await waitForRegistration(entry, startedAt, opts);
}

export async function startApp(slug: string, opts: InstallOptions): Promise<void> {
  const row = await opts.registry.getApp(slug);
  if (!row?.container_name) throw new Error(`"${slug}" is not installed yet`);
  await docker.startContainer(row.container_name);
  await opts.registry.setInstallStatus(slug, "running");
}

export async function stopApp(slug: string, opts: InstallOptions): Promise<void> {
  const row = await opts.registry.getApp(slug);
  if (!row?.container_name) throw new Error(`"${slug}" is not installed yet`);
  await docker.stopContainer(row.container_name);
  await opts.registry.setInstallStatus(slug, "stopped");
}

export async function restartApp(slug: string, opts: InstallOptions): Promise<void> {
  const row = await opts.registry.getApp(slug);
  if (!row?.container_name) throw new Error(`"${slug}" is not installed yet`);
  await docker.restartContainer(row.container_name);
  await opts.registry.setInstallStatus(slug, "running");
}

/**
 * Re-resolves the image (new version if given, otherwise the registry's
 * `latest` or the local workspace's current package.json version) and
 * recreates the container against the same DB schema. A fresh registration
 * token is issued (the old one's plaintext was never retrievable — only
 * its hash was stored) and baked into the new container's env, so the app
 * re-registers itself as part of boot, same as a fresh install.
 */
export async function upgradeApp(slug: string, opts: InstallOptions, targetVersion?: string): Promise<void> {
  const entry = getCatalogEntry(slug);
  if (!entry) throw new Error(`"${slug}" is not in the app catalog`);
  const row = await opts.registry.getApp(slug);
  if (!row?.pg_connection_string_encrypted) throw new Error(`"${slug}" is not installed yet`);

  const { appToken } = await issueManagedToken(slug, opts);
  const startedAt = Date.now();

  const { ref, version } = await resolveImage(entry, opts, targetVersion);

  const name = containerName(entry.slug);
  await docker.removeContainer(name);
  await docker.runContainer({
    name,
    image: ref,
    env: buildContainerEnv(entry, opts.config, appToken),
    hostPort: entry.hostPort,
    containerPort: entry.containerPort,
    publish: opts.config.TWODB_APP_PUBLISH_PORTS,
  });
  await opts.registry.setContainerInfo(entry.slug, { imageTag: ref, containerName: name, hostPort: entry.hostPort });
  await opts.registry.setVersion(entry.slug, version);

  await waitForRegistration(entry, startedAt, opts);
}

/**
 * Rotates an app's token.
 * - Unmanaged: mints a fresh 30-day token, revokes the old "api" tokens and
 *   returns the plaintext once (the app must be given the new value; its
 *   twodb-core client also recovers on its own via TWODB_REGISTRATION_SECRET).
 * - Managed: mints a fresh non-expiring token, recreates the container with
 *   it (same image, same DB credentials + data key), waits for the app to
 *   re-register, then revokes the old token.
 */
export async function rotateAppToken(
  slug: string,
  opts: InstallOptions,
): Promise<{ managed: false; appToken: string; expiresAt: string | null } | { managed: true; run: () => Promise<void> }> {
  const row = await opts.registry.getApp(slug);
  if (!row) throw new Error(`"${slug}" is not registered`);

  if (!row.managed || !row.container_name || !row.image_tag) {
    await opts.registry.revokeTokens(slug);
    const { appToken, expiresAt } = await issueApiToken(slug, opts);
    return { managed: false, appToken, expiresAt };
  }

  const entry = getCatalogEntry(slug);
  if (!entry) throw new Error(`"${slug}" is not in the app catalog`);

  return {
    managed: true,
    run: async () => {
      const appToken = generateAppToken();
      await opts.registry.issueToken(slug, "managed", appToken, null);
      const startedAt = Date.now();
      await docker.removeContainer(row.container_name!);
      await docker.runContainer({
        name: row.container_name!,
        image: row.image_tag!,
        env: buildContainerEnv(entry, opts.config, appToken),
        hostPort: entry.hostPort,
        containerPort: entry.containerPort,
        publish: opts.config.TWODB_APP_PUBLISH_PORTS,
      });
      await waitForRegistration(entry, startedAt, opts);
      // Only now that the new token demonstrably works, retire the old ones.
      await opts.registry.revokeTokensExcept(slug, "managed", appToken);
    },
  };
}

export async function removeApp(slug: string, opts: InstallOptions): Promise<void> {
  const row = await opts.registry.getApp(slug);
  if (row?.container_name) await docker.removeContainer(row.container_name);
  await opts.registry.remove(slug);
}

export async function getContainerStatus(slug: string, opts: InstallOptions): Promise<docker.ContainerStatus> {
  const row = await opts.registry.getApp(slug);
  if (!row?.container_name) return "not_found";
  return docker.inspectStatus(row.container_name);
}
