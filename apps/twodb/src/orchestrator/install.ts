import * as path from "node:path";
import * as fs from "node:fs";
import type { RegistryRepo } from "../db/registry.js";
import type { TwoDbConfig } from "../config.js";
import { getCatalogEntry, type CatalogEntry } from "./catalog.js";
import { generateRegistrationToken } from "./tokens.js";
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
 * Generates a fresh per-app registration token and records its hash (never
 * the plaintext) against `slug`. Used both by the full Docker install flow
 * below and, standalone, for local dev — run `pnpm dev` directly instead of
 * through a container, with this token in `TWODB_PROVISION_TOKEN` and the
 * connection string from `provisionDatabase()` in `DATABASE_URL`.
 */
export async function issueRegistrationToken(slug: string, opts: InstallOptions): Promise<{ registrationToken: string }> {
  const entry = getCatalogEntry(slug);
  if (!entry) throw new Error(`"${slug}" is not in the app catalog`);

  const registrationToken = generateRegistrationToken();
  await opts.registry.beginInstall(
    {
      slug: entry.slug,
      name: entry.slug,
      version: workspaceVersion(entry),
      shape: "backend",
      basePath: `/apps/${entry.slug}`,
      hostId: "docker",
      capabilities: [],
    },
    registrationToken,
  );
  return { registrationToken };
}

/**
 * Creates (or re-reads, for a slug already provisioned) the app's Postgres
 * schema+role. Returns both connection-string forms exactly once — plain
 * for a developer's local `.env` (admin's own view of the host), and the
 * container-reachable form for Docker. Only the container form is persisted
 * (encrypted), since that's the one `upgradeApp`/`restartApp` need again.
 */
export async function provisionDatabase(slug: string, opts: InstallOptions) {
  const provisioned = await provisionAppDatabase(
    opts.config.TWODB_PG_ADMIN_URL,
    slug,
    opts.config.TWODB_PG_CONTAINER_HOST,
  );
  const encrypted = encryptSecret(provisioned.containerConnectionString, opts.config.AUTH_SECRET);
  await opts.registry.setProvisioning(slug, provisioned.schema, provisioned.role, encrypted);
  return {
    schema: provisioned.schema,
    role: provisioned.role,
    connectionString: provisioned.connectionString,
    containerConnectionString: provisioned.containerConnectionString,
  };
}

function buildContainerEnv(entry: CatalogEntry, config: TwoDbConfig, registrationToken: string, dbUrl: string) {
  return {
    NODE_ENV: "production",
    PORT: String(entry.containerPort),
    DATABASE_URL: dbUrl,
    TWODB_GATEWAY_URL: config.TWODB_GATEWAY_URL_FOR_CONTAINERS,
    TWODB_PROVISION_TOKEN: registrationToken,
    TWODB_HOST_ID: "docker",
    // What the app tells TwoDB its reachable URL is at registration time —
    // the gateway proxies to this. Both run on the same host, so it's the
    // published host port as seen from the host's loopback.
    HTTP_URL: `http://localhost:${entry.hostPort}`,
  };
}

/**
 * Pull-registration: polls a freshly-started container's published port for
 * `GET /internal/manifest` (token-guarded — see
 * core-platform/src/manifest/serve.ts for why this exists alongside the
 * app's own push registration) and completes registration in-process. A
 * correct manifest response proves the responder is the exact app TwoDB
 * installed: only it holds the registration token injected into its env.
 *
 * Throws if the app never comes up, which the caller's runLifecycle wrapper
 * records as install_status "failed".
 */
async function pullRegister(
  entry: CatalogEntry,
  registrationToken: string,
  opts: InstallOptions,
  { attempts = 60, intervalMs = 2000 }: { attempts?: number; intervalMs?: number } = {},
): Promise<void> {
  const url = `http://localhost:${entry.hostPort}/internal/manifest`;
  let lastError: unknown = new Error("never attempted");

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "x-registration-token": registrationToken } });
      if (res.status === 401) throw new Error(`app at ${url} rejected the registration token`);
      if (res.ok) {
        const body = (await res.json()) as { slug: string; httpUrl: string; manifest: unknown };
        if (body.slug !== entry.slug) {
          throw new Error(`port ${entry.hostPort} is served by "${body.slug}", expected "${entry.slug}"`);
        }
        const result = await opts.registry.completeRegistration({
          slug: entry.slug,
          registrationToken,
          httpUrl: body.httpUrl,
          manifestJson: body.manifest,
        });
        if (!result.ok) throw new Error(`completeRegistration failed: ${result.reason}`);
        return;
      }
      lastError = new Error(`GET ${url} -> ${res.status}`);
    } catch (err) {
      lastError = err;
      // A 401/slug-mismatch is a hard failure — retrying won't fix it.
      if (err instanceof Error && /rejected the registration token|is served by/.test(err.message)) throw err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`app "${entry.slug}" never served /internal/manifest after ${attempts} attempts: ${String(lastError)}`);
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
 * then pull-registers the app via its token-guarded /internal/manifest
 * endpoint — `install_status` goes "installing" -> "running" once the app
 * actually answers. Poll `GET /orchestrator/apps/:slug/status`.
 */
export async function installApp(slug: string, opts: InstallOptions, requestedVersion?: string): Promise<void> {
  const entry = getCatalogEntry(slug);
  if (!entry) throw new Error(`"${slug}" is not in the app catalog`);

  const { registrationToken } = await issueRegistrationToken(slug, opts);
  const { containerConnectionString } = await provisionDatabase(slug, opts);

  const { ref, version } = await resolveImage(entry, opts, requestedVersion);

  const name = containerName(entry.slug);
  await docker.runContainer({
    name,
    image: ref,
    env: buildContainerEnv(entry, opts.config, registrationToken, containerConnectionString),
    hostPort: entry.hostPort,
    containerPort: entry.containerPort,
  });
  await opts.registry.setContainerInfo(entry.slug, { imageTag: ref, containerName: name, hostPort: entry.hostPort });
  await opts.registry.setVersion(entry.slug, version);

  await pullRegister(entry, registrationToken, opts);
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

  const dbUrl = decryptSecret(row.pg_connection_string_encrypted, opts.config.AUTH_SECRET);
  const { registrationToken } = await issueRegistrationToken(slug, opts);

  const { ref, version } = await resolveImage(entry, opts, targetVersion);

  const name = containerName(entry.slug);
  await docker.removeContainer(name);
  await docker.runContainer({
    name,
    image: ref,
    env: buildContainerEnv(entry, opts.config, registrationToken, dbUrl),
    hostPort: entry.hostPort,
    containerPort: entry.containerPort,
  });
  await opts.registry.setContainerInfo(entry.slug, { imageTag: ref, containerName: name, hostPort: entry.hostPort });
  await opts.registry.setVersion(entry.slug, version);

  await pullRegister(entry, registrationToken, opts);
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
