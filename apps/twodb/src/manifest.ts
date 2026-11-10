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
    "An installed app calls this once it boots, presenting the unique per-app registration token TwoDB " +
    "generated for it at install time (not session/API-key auth — the app has no workspace context yet). " +
    "There is no shared secret: a token only ever authenticates the one slug it was issued for.",
  request: z.object({
    slug: z.string(),
    registrationToken: z.string(),
    httpUrl: z.string(),
    socketPath: z.string().optional(),
    manifest: z.unknown(),
  }),
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

const installApp = defineEndpoint({
  name: "installApp",
  method: "POST",
  path: "/orchestrator/apps/:slug/install",
  auth: "session",
  description:
    "Full one-click install: provisions the app's Postgres schema, resolves its Docker image (pulls " +
    "`$TWODB_APP_IMAGE_REGISTRY/app-<slug>:<version ?? latest>` when a registry is configured, otherwise " +
    "builds locally from the workspace at its package.json version), issues a unique registration token, " +
    "and starts the container. Async — poll getAppStatus until installStatus is \"running\" and " +
    "registrationStatus is \"active\".",
  request: z.object({ slug: z.string(), version: z.string().optional() }),
  response: z.object({ ok: z.literal(true), status: z.literal("installing") }),
});

const issueToken = defineEndpoint({
  name: "issueRegistrationToken",
  method: "POST",
  path: "/orchestrator/apps/:slug/issue-token",
  auth: "session",
  description:
    "Issues a registration token without touching Docker — for running an app directly via `pnpm dev` " +
    "instead of as a container. Returns the plaintext token exactly once.",
  request: z.object({ slug: z.string() }),
  response: z.object({ registrationToken: z.string() }),
});

const provisionDb = defineEndpoint({
  name: "provisionDatabase",
  method: "POST",
  path: "/orchestrator/apps/:slug/provision-db",
  auth: "session",
  description:
    "Creates (or rotates) a Postgres role+schema for the named app, independent of Docker, and ensures its " +
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
    listApps,
    getAppManifest,
    getAppMessages,
    listCatalog,
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
