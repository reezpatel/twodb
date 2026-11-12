// @twodb/twodb-core — the backend SDK every TwoDB app uses to plug into the
// control plane. One call, `connectTwoDb()`, does:
//   1. authenticate: app token (TWODB_APP_TOKEN — injected for managed
//      containers) or, for apps you run yourself, TWODB_REGISTRATION_SECRET
//      which mints a 30-day token at registration (cached on disk);
//   2. register with the gateway (POST /registry/register);
//   3. heartbeat (POST /registry/ping every 10s; the control plane marks the
//      app inactive after 30s of silence; re-registers itself on 401/404);
//   4. fetch runtime config (GET /registry/config) → Postgres + S3 + data key,
//      and build the connections for you.
// All gateway calls the app makes afterwards go through `gatewayFetch`, which
// stamps x-twodb-app / x-twodb-token.

import type { Kysely } from "kysely";
import { createPgDb } from "@twodb/core-data/db";
import { createS3Storage, type StorageAdapter } from "@twodb/core-data/storage";
import { toEndpointJson, type AppManifestSpec } from "@twodb/core-platform/manifest";
import {
  APP_HEADER,
  TOKEN_HEADER,
  REGISTRATION_SECRET_HEADER,
  VERIFIED_HEADER,
  TwoDbHttpError,
  createFileTokenStore,
  withNetworkRetry,
} from "./client.js";

export { APP_HEADER, TOKEN_HEADER, VERIFIED_HEADER, TwoDbHttpError };

export interface ConnectOptions {
  /** Defaults to manifest.slug / TWODB_APP_SLUG. */
  slug?: string;
  /** Used for registration; the manifest is sent as the app's endpoint.json. */
  manifest?: AppManifestSpec;
  /** Display name when no manifest is given. */
  name?: string;
  version?: string;
  capabilities?: string[];
  /** Control-plane URL. Default: env TWODB_GATEWAY_URL. */
  gatewayUrl?: string;
  /** Where the gateway should proxy to. Default: env HTTP_URL. */
  httpUrl?: string;
  /** App token. Default: env TWODB_APP_TOKEN (or legacy TWODB_PROVISION_TOKEN), then the on-disk cache. */
  token?: string;
  /** Shared secret for self-registration. Default: env TWODB_REGISTRATION_SECRET. */
  registrationSecret?: string;
  /** Where minted tokens are cached. Default: ./.twodb/<slug>.token (set false to disable). */
  tokenFile?: string | false;
  /** Heartbeat period (default 10_000 — the control plane's timeout is 30s). */
  pingIntervalMs?: number;
  /** Skip creating the Postgres / S3 handles (config is still returned). */
  skipConnections?: boolean;
  /** Max pool size for Postgres. */
  pgPoolMax?: number;
  onHeartbeatError?: (err: unknown) => void;
}

export interface TwoDbAppConfig {
  slug: string;
  postgres: { connectionString: string; schema: string; role: string };
  s3: {
    bucket: string;
    prefix: string;
    region: string | null;
    endpoint: string | null;
    forcePathStyle: boolean;
    accessKeyId: string;
    secretAccessKey: string;
  } | null;
  dataKey?: string;
}

export interface TwoDbRuntime {
  slug: string;
  config: TwoDbAppConfig;
  dataKey: string | undefined;
  /** Kysely client scoped to the app's schema (created on first use, shared). Throws if skipConnections. */
  db<DB = unknown>(): Kysely<DB>;
  /** Prefix-scoped S3 storage, or null when the control plane has no S3 configured. */
  storage: StorageAdapter | null;
  /** fetch against the gateway as this app (adds x-twodb-app / x-twodb-token). `path` is relative to the gateway, e.g. "/apps/twomail/threads". */
  gatewayFetch(path: string, init?: RequestInit): Promise<Response>;
  /** Current app token (may change after a re-registration). */
  token(): string;
  /** Stops the heartbeat and closes the DB pool. */
  close(): Promise<void>;
}

/** Wraps a storage adapter so every key lives under `prefix` (the control plane hands each app `<slug>/`). */
export function withKeyPrefix(inner: StorageAdapter, prefix: string): StorageAdapter {
  const p = prefix.replace(/^\/+/, "");
  const k = (key: string) => p + key.replace(/^\/+/, "");
  const unk = (key: string) => (key.startsWith(p) ? key.slice(p.length) : key);
  return {
    put: async (key, data, opts) => ({ ...(await inner.put(k(key), data, opts)), key }),
    get: (key) => inner.get(k(key)),
    getStream: (key) => inner.getStream(k(key)),
    delete: (key) => inner.delete(k(key)),
    list: async (pre) => (await inner.list(k(pre))).map((o) => ({ ...o, key: unk(o.key) })),
    getSignedUrl: inner.getSignedUrl ? (key, exp) => inner.getSignedUrl!(k(key), exp) : undefined,
  };
}

/** What a registered, heartbeating app can do without needing its Postgres/S3 config (e.g. stub/scaffold apps). */
export interface TwoDbSession {
  slug: string;
  token(): string;
  gatewayFetch(path: string, init?: RequestInit): Promise<Response>;
  /** Fetches the runtime config (provisions Postgres on first call for a new app). */
  fetchConfig(): Promise<TwoDbAppConfig>;
  /** Stops the heartbeat. */
  close(): Promise<void>;
}

/**
 * Registers with the control plane and keeps the app alive (10s heartbeat,
 * automatic re-registration). Does NOT fetch Postgres/S3 config — use
 * `connectTwoDb` for that.
 */
export async function startTwoDbSession(options: ConnectOptions = {}): Promise<TwoDbSession> {
  const env = process.env;
  const slug = options.slug ?? options.manifest?.slug ?? env.TWODB_APP_SLUG;
  if (!slug) throw new Error("twodb-core: slug is required (option, manifest.slug or TWODB_APP_SLUG)");
  const gatewayUrl = (options.gatewayUrl ?? env.TWODB_GATEWAY_URL ?? "http://localhost:6400").replace(/\/+$/, "");
  const httpUrl = options.httpUrl ?? env.HTTP_URL;
  if (!httpUrl) throw new Error("twodb-core: httpUrl is required (option or HTTP_URL) — where the gateway reaches this app");
  const secret = options.registrationSecret ?? env.TWODB_REGISTRATION_SECRET;
  const store = options.tokenFile === false ? null : createFileTokenStore(options.tokenFile ?? `.twodb/${slug}.token`);

  let token: string | null = options.token ?? env.TWODB_APP_TOKEN ?? env.TWODB_PROVISION_TOKEN ?? store?.read() ?? null;

  const url = (p: string) => gatewayUrl + p;
  const authHeaders = (): Record<string, string> => ({ [APP_HEADER]: slug, ...(token ? { [TOKEN_HEADER]: token } : {}) });

  async function register(useSecret: boolean): Promise<void> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (useSecret) {
      if (!secret) throw new Error("twodb-core: no valid app token and no TWODB_REGISTRATION_SECRET to mint one");
      headers[REGISTRATION_SECRET_HEADER] = secret;
    } else {
      Object.assign(headers, authHeaders());
    }
    const res = await fetch(url("/registry/register"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        slug,
        name: options.manifest?.name ?? options.name,
        version: options.manifest?.version ?? options.version,
        capabilities: options.manifest?.capabilities ?? options.capabilities,
        httpUrl,
        manifest: options.manifest ? toEndpointJson(options.manifest) : {},
      }),
    });
    if (!res.ok) throw new TwoDbHttpError(res.status, await res.text(), `register(${slug})`);
    const body = (await res.json()) as { token?: string };
    if (body.token) {
      token = body.token;
      store?.write(token);
    }
  }

  /** Register with the existing token if we have one, falling back to the secret if it's rejected/expired. */
  async function registerAuto(): Promise<void> {
    await withNetworkRetry(async () => {
      if (token) {
        try {
          return await register(false);
        } catch (err) {
          if (!(err instanceof TwoDbHttpError && err.status === 401 && secret)) throw err;
        }
      }
      await register(true);
    });
  }

  await registerAuto();

  // --- heartbeat ---------------------------------------------------------
  const pingMs = options.pingIntervalMs ?? 10_000;
  let pinging = false;
  const timer = setInterval(async () => {
    if (pinging) return;
    pinging = true;
    try {
      const res = await fetch(url("/registry/ping"), { method: "POST", headers: authHeaders() });
      // Token expired/revoked (401) or control plane lost us (404): register again.
      if (res.status === 401 || res.status === 404) await registerAuto();
      else if (!res.ok) throw new TwoDbHttpError(res.status, await res.text(), "ping");
    } catch (err) {
      options.onHeartbeatError?.(err);
    } finally {
      pinging = false;
    }
  }, pingMs);
  timer.unref();

  return {
    slug,
    token: () => token ?? "",
    gatewayFetch(p, init = {}) {
      const headers = new Headers(init.headers);
      for (const [k, v] of Object.entries(authHeaders())) headers.set(k, v);
      return fetch(url(p), { ...init, headers });
    },
    async fetchConfig() {
      const cfgRes = await withNetworkRetry(() => fetch(url("/registry/config"), { headers: authHeaders() }));
      if (!cfgRes.ok) throw new TwoDbHttpError(cfgRes.status, await cfgRes.text(), `fetch config(${slug})`);
      return (await cfgRes.json()) as TwoDbAppConfig;
    },
    async close() {
      clearInterval(timer);
    },
  };
}

export async function connectTwoDb(options: ConnectOptions = {}): Promise<TwoDbRuntime> {
  const session = await startTwoDbSession(options);
  const slug = session.slug;
  const config = await session.fetchConfig();

  let dbHandle: Kysely<any> | null = null;
  let storage: StorageAdapter | null = null;
  if (!options.skipConnections && config.s3) {
    const s3 = config.s3;
    const raw = await createS3Storage({
      bucket: s3.bucket,
      region: s3.region ?? undefined,
      endpoint: s3.endpoint ?? undefined,
      forcePathStyle: s3.forcePathStyle,
      credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
    });
    storage = withKeyPrefix(raw, s3.prefix);
  }

  return {
    slug,
    config,
    dataKey: config.dataKey,
    db<DB = unknown>() {
      if (options.skipConnections) throw new Error("twodb-core: connections disabled (skipConnections)");
      dbHandle ??= createPgDb<any>({
        connectionString: config.postgres.connectionString,
        schema: config.postgres.schema,
        max: options.pgPoolMax,
      });
      return dbHandle as Kysely<DB>;
    },
    storage,
    gatewayFetch: session.gatewayFetch,
    token: session.token,
    async close() {
      await session.close();
      await dbHandle?.destroy();
    },
  };
}

/**
 * For apps behind the gateway: was this request stamped by the gateway as
 * coming from a verified app? (The gateway always strips inbound copies of
 * these headers, so they can be trusted whenever the request arrived via the
 * gateway.)
 */
export function callerApp(headers: Headers | Record<string, string | string[] | undefined>): { verified: boolean; slug: string | null } {
  const get = (name: string): string | null => {
    if (headers instanceof Headers) return headers.get(name);
    const v = headers[name];
    return Array.isArray(v) ? v[0] ?? null : v ?? null;
  };
  const verified = get(VERIFIED_HEADER) === "true";
  return { verified, slug: verified ? get(APP_HEADER) : null };
}
