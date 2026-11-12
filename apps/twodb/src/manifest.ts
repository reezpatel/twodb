import { z } from "zod";
import { defineAppManifest, defineEndpoint } from "@twodb/core-platform/manifest";

// TwoDB is the one app whose routes are registered by hand in
// src/gateway/server.ts (it *is* the gateway/registry — there's no "another
// app" to proxy to for its own routes). This manifest exists purely so
// TwoDB gets the same generated ENDPOINTS.md/endpoint.json every other app
// gets, and so twodb-cli can call TwoDB's own control-plane endpoints the
// same way it calls any other app.

const registerApp = defineEndpoint({
  name: "registerApp",
  method: "POST",
  path: "/registry/register",
  auth: "public",
  description:
    "App-initiated registration — the only way an app becomes known to the gateway. Authenticate with " +
    "`x-twodb-app` + `x-twodb-token` (re-registration) or the shared `x-twodb-registration-secret` " +
    "(TWODB_REGISTRATION_SECRET); the secret path mints and returns a 30-day app token. Managed containers " +
    "use the non-expiring token TwoDB injected (TWODB_APP_TOKEN).",
  request: z.object({
    slug: z.string(),
    name: z.string().optional(),
    version: z.string().optional(),
    httpUrl: z.string(),
    socketPath: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
    manifest: z.unknown(),
  }),
  response: z.object({ ok: z.literal(true), created: z.boolean(), token: z.string().optional(), expiresAt: z.string().nullable().optional() }),
});

const pingApp = defineEndpoint({
  name: "pingApp",
  method: "POST",
  path: "/registry/ping",
  auth: "public",
  description:
    "Heartbeat (auth: x-twodb-app + x-twodb-token). Apps ping every 10s; after 30s of silence the control plane marks the app inactive.",
  response: z.object({ ok: z.literal(true), pong: z.literal(true), intervalMs: z.number(), timeoutMs: z.number() }),
});

const getAppConfig = defineEndpoint({
  name: "getAppConfig",
  method: "GET",
  path: "/registry/config",
  auth: "public",
  description:
    "Runtime config for the calling app (auth: x-twodb-app + x-twodb-token): its Postgres connection/schema/role, " +
    "its S3 bucket + key prefix + credentials (null when S3 isn't configured), and its stable data key. Consumed by twodb-core.",
  response: z.object({
    slug: z.string(),
    postgres: z.object({ connectionString: z.string(), schema: z.string(), role: z.string() }),
    s3: z
      .object({
        bucket: z.string(),
        prefix: z.string(),
        region: z.string().nullable(),
        endpoint: z.string().nullable(),
        forcePathStyle: z.boolean(),
        accessKeyId: z.string(),
        secretAccessKey: z.string(),
      })
      .nullable(),
    dataKey: z.string().optional(),
  }),
});

const oauthAuthorize = defineEndpoint({
  name: "oauthAuthorize",
  method: "POST",
  path: "/registry/oauth/authorize",
  auth: "session",
  description:
    "\"Login with TwoDB\" step 1 (called by the TwoDB webapp /authorize page with the user's own session): issues a " +
    "one-time 60s authorization code bound to the PKCE challenge and an allowed redirect URI, and returns where to send the browser.",
  request: z.object({ redirectUri: z.string(), codeChallenge: z.string(), state: z.string().optional() }),
  response: z.object({ redirectTo: z.string() }),
});

const oauthToken = defineEndpoint({
  name: "oauthToken",
  method: "POST",
  path: "/registry/oauth/token",
  auth: "public",
  description:
    "\"Login with TwoDB\" step 2 (called by the app webapp): exchanges the code + PKCE verifier for a session token, " +
    "usable as `Authorization: Bearer <accessToken>` on every gateway route and /api/auth/*.",
  request: z.object({ code: z.string(), codeVerifier: z.string(), redirectUri: z.string() }),
  response: z.object({ tokenType: z.literal("Bearer"), accessToken: z.string(), expiresAt: z.string() }),
});

const createAppToken = defineEndpoint({
  name: "createAppToken",
  method: "POST",
  path: "/registry/apps/:slug/tokens",
  auth: "session",
  description: "Mints a 30-day app token for an app TwoDB doesn't run. Plaintext returned once.",
  request: z.object({ slug: z.string() }),
  response: z.object({ token: z.string(), expiresAt: z.string().nullable() }),
});

const listAppTokens = defineEndpoint({
  name: "listAppTokens",
  method: "GET",
  path: "/registry/apps/:slug/tokens",
  auth: "session",
  description: "Token metadata for an app (never the token itself).",
  response: z.object({ tokens: z.array(z.object({ id: z.string(), slug: z.string(), kind: z.string(), created_at: z.string(), expires_at: z.string().nullable(), revoked_at: z.string().nullable(), last_used_at: z.string().nullable() })) }),
});

const rotateAppTokenEp = defineEndpoint({
  name: "rotateAppToken",
  method: "POST",
  path: "/registry/apps/:slug/rotate-token",
  auth: "session",
  description:
    "Rotates the app's token (user session only). Unmanaged: revokes old tokens and returns a new 30-day token once. " +
    "Managed: mints a new non-expiring token and recreates the container (async — poll getAppStatus), then revokes the old one.",
  request: z.object({ slug: z.string() }),
  response: z.object({ ok: z.literal(true), managed: z.boolean(), token: z.string().optional(), expiresAt: z.string().nullable().optional(), status: z.string().optional() }),
});

const revokeAppToken = defineEndpoint({
  name: "revokeAppToken",
  method: "DELETE",
  path: "/registry/tokens/:id",
  auth: "session",
  description: "Revokes an app token immediately.",
  response: z.object({ ok: z.literal(true) }),
});

const listApps = defineEndpoint({
  name: "listApps",
  method: "GET",
  path: "/registry/apps",
  auth: "session-or-apiKey",
  description: "Lists every app TwoDB knows about (installed, running, stopped, or not-yet-registered).",
  response: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      basePath: z.string(),
      status: z.string(),
      installStatus: z.string(),
    }),
  ),
});

const getAppManifest = defineEndpoint({
  name: "getAppManifest",
  method: "GET",
  path: "/registry/apps/:slug/endpoint.json",
  auth: "session-or-apiKey",
  description: "Returns one app's cached endpoint.json, as last reported at registration time.",
  request: z.object({ slug: z.string() }),
});

const getAppMessages = defineEndpoint({
  name: "getAppMessages",
  method: "GET",
  path: "/registry/apps/:slug/messages.json",
  auth: "session-or-apiKey",
  description:
    "Returns one app's messages contract (queue jobs + broadcast events) from its checked-in " +
    "messages.json — unlike endpoint.json this isn't self-reported at registration, TwoDB serves the " +
    "copy from its own monorepo checkout.",
  request: z.object({ slug: z.string() }),
});

const listCatalog = defineEndpoint({
  name: "listCatalog",
  method: "GET",
  path: "/orchestrator/catalog",
  auth: "session-or-apiKey",
  description: "Lists every app available to install (the static catalog — see src/orchestrator/catalog.ts).",
  response: z.array(z.object({ slug: z.string(), hostPort: z.number() })),
});

const listApiKeys = defineEndpoint({
  name: "listApiKeys",
  method: "GET",
  path: "/registry/api-keys",
  auth: "session",
  description:
    "Lists the caller's workspace API keys (workspace platform's api_key table — the ones x-api-key auth verifies). " +
    "Hashes never leave the DB; revoked keys are included with their revokedAt set.",
  response: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      prefix: z.string(),
      scopes: z.array(z.string()),
      createdAt: z.string(),
      lastUsedAt: z.string().nullable(),
      revokedAt: z.string().nullable(),
    }),
  ),
});

const createApiKey = defineEndpoint({
  name: "createApiKey",
  method: "POST",
  path: "/registry/api-keys",
  auth: "session",
  description:
    "Issues a workspace API key. The raw key (format twodb_<prefix>_<secret>) is returned EXACTLY ONCE — only its " +
    "sha256 is stored. Use it as the x-api-key header on gateway calls.",
  request: z.object({ name: z.string() }),
  response: z.object({
    key: z.object({
      id: z.string(),
      name: z.string(),
      prefix: z.string(),
      scopes: z.array(z.string()),
      createdAt: z.string(),
      lastUsedAt: z.string().nullable(),
      revokedAt: z.string().nullable(),
    }),
    rawKey: z.string(),
  }),
});

const revokeApiKey = defineEndpoint({
  name: "revokeApiKey",
  method: "DELETE",
  path: "/registry/api-keys/:id",
  auth: "session",
  description:
    "Revokes one of the caller's workspace API keys. Scoped to the workspace: ids from another workspace 404.",
  request: z.object({ id: z.string() }),
  response: z.object({ ok: z.literal(true) }),
});

const listSpaces = defineEndpoint({
  name: "listSpaces",
  method: "GET",
  path: "/registry/spaces",
  auth: "session",
  description:
    "Lists the caller's workspace spaces — the sub-scopes that apps (e.g. TwoRoute connections) link themselves to.",
  response: z.array(z.object({ id: z.string(), name: z.string(), createdAt: z.string().nullable() })),
});

const createSpace = defineEndpoint({
  name: "createSpace",
  method: "POST",
  path: "/registry/spaces",
  auth: "session",
  description: "Creates a space in the caller's workspace.",
  request: z.object({ name: z.string() }),
  response: z.object({ space: z.object({ id: z.string(), name: z.string() }) }),
});



const installApp = defineEndpoint({
  name: "installApp",
  method: "POST",
  path: "/orchestrator/apps/:slug/install",
  auth: "session",
  description:
    "Full one-click install: provisions the app's Postgres schema, resolves its Docker image (pulls " +
    "`$TWODB_APP_IMAGE_REGISTRY/app-<slug>:<version ?? latest>` when a registry is configured, otherwise " +
    "builds locally from the workspace at its package.json version), mints a non-expiring app token (TWODB_APP_TOKEN), " +
    "and starts the container. Async — poll getAppStatus until installStatus is \"running\" and " +
    "registrationStatus is \"active\".",
  request: z.object({ slug: z.string(), version: z.string().optional() }),
  response: z.object({ ok: z.literal(true), status: z.literal("installing") }),
});

const issueToken = defineEndpoint({
  name: "issueAppToken",
  method: "POST",
  path: "/orchestrator/apps/:slug/issue-token",
  auth: "session",
  description:
    "Mints a 30-day app token without touching Docker — for running an app directly via `pnpm dev` " +
    "instead of as a container. Returns the plaintext token exactly once.",
  request: z.object({ slug: z.string() }),
  response: z.object({ appToken: z.string(), expiresAt: z.string().nullable() }),
});

const provisionDb = defineEndpoint({
  name: "provisionDatabase",
  method: "POST",
  path: "/orchestrator/apps/:slug/provision-db",
  auth: "session",
  description:
    "Creates (idempotently — credentials are NOT changed on repeat calls unless `rotate: true`) a Postgres role+schema for the named app, independent of Docker, and ensures its " +
    "stable per-app data key exists (TWODB_DATA_KEY — never rotated, unlike registration tokens). Returns " +
    "both connection-string forms + the data key exactly once.",
  request: z.object({ slug: z.string() }),
  response: z.object({
    schema: z.string(),
    role: z.string(),
    connectionString: z.string(),
    containerConnectionString: z.string(),
    dataKey: z.string(),
  }),
});

const startApp = defineEndpoint({
  name: "startApp",
  method: "POST",
  path: "/orchestrator/apps/:slug/start",
  auth: "session",
  description: "Starts a previously-installed app's stopped container.",
  request: z.object({ slug: z.string() }),
});

const stopApp = defineEndpoint({
  name: "stopApp",
  method: "POST",
  path: "/orchestrator/apps/:slug/stop",
  auth: "session",
  description: "Stops a running app's container without removing it.",
  request: z.object({ slug: z.string() }),
});

const restartApp = defineEndpoint({
  name: "restartApp",
  method: "POST",
  path: "/orchestrator/apps/:slug/restart",
  auth: "session",
  description: "Restarts an app's container in place (same image, same DB).",
  request: z.object({ slug: z.string() }),
});

const upgradeApp = defineEndpoint({
  name: "upgradeApp",
  method: "POST",
  path: "/orchestrator/apps/:slug/upgrade",
  auth: "session",
  description:
    "Re-resolves the app's image (to `version` if given, otherwise the registry's `latest` or the local " +
    "workspace's current package.json version) and recreates its container against the same Postgres " +
    "schema, with a freshly issued registration token. Async — poll getAppStatus.",
  request: z.object({ slug: z.string(), version: z.string().optional() }),
  response: z.object({ ok: z.literal(true), status: z.literal("installing") }),
});

const removeApp = defineEndpoint({
  name: "removeApp",
  method: "DELETE",
  path: "/orchestrator/apps/:slug",
  auth: "session",
  description:
    "Removes the app's container and its registry row. Does NOT drop its Postgres schema — that's a " +
    "deliberately separate, more dangerous operation left for a future endpoint.",
  request: z.object({ slug: z.string() }),
});

const getAppStatus = defineEndpoint({
  name: "getAppStatus",
  method: "GET",
  path: "/orchestrator/apps/:slug/status",
  auth: "session-or-apiKey",
  description:
    "Combined install/registration/container status for one app — poll this after install/upgrade/restart.",
  request: z.object({ slug: z.string() }),
  response: z.object({
    slug: z.string(),
    installStatus: z.string(),
    registrationStatus: z.string(),
    containerStatus: z.string(),
    version: z.string().nullable(),
    imageTag: z.string().nullable(),
    lastSeenAt: z.string().nullable(),
  }),
});

const search = defineEndpoint({
  name: "search",
  method: "POST",
  path: "/search",
  auth: "session-or-apiKey",
  description: "Federated search — fans a query out to every app that declared the `search` capability.",
  request: z.object({ query: z.string() }),
  response: z.object({
    results: z.array(z.object({ app: z.string(), results: z.array(z.unknown()), error: z.string().optional() })),
  }),
});

const proxy = defineEndpoint({
  name: "proxy",
  method: "GET",
  path: "/apps/:slug/*",
  auth: "session-or-apiKey",
  description:
    "Generic reverse proxy to a registered app, over whichever transport (unix socket same-host, TCP otherwise) " +
    "the registry chose. All methods are supported, not just GET; streaming responses are passed through unbuffered.",
  streaming: true,
});

export const twodbManifest = defineAppManifest({
  name: "TwoDB",
  slug: "twodb",
  version: "0.1.0",
  shape: "backend+webapp",
  description:
    "The control plane: Docker-based app installation/lifecycle management, Postgres schema provisioning, " +
    "identity (TwoAuth), and the Gateway every other app's traffic flows through.",
  capabilities: [],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/",
  endpoints: [
    registerApp,
    pingApp,
    getAppConfig,
    oauthAuthorize,
    oauthToken,
    createAppToken,
    listAppTokens,
    rotateAppTokenEp,
    revokeAppToken,
    listApps,
    getAppManifest,
    getAppMessages,
    listCatalog,
    listApiKeys,
    createApiKey,
    revokeApiKey,
    listSpaces,
    createSpace,
    installApp,
    issueToken,
    provisionDb,
    startApp,
    stopApp,
    restartApp,
    upgradeApp,
    removeApp,
    getAppStatus,
    search,
    proxy,
  ],
});

export default twodbManifest;
