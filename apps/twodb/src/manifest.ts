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
    "Self-registration endpoint every app calls on boot (shared-secret guarded via x-provision-token, " +
    "not session/API-key auth — this is how an app first introduces itself before it has any workspace context).",
  request: z.object({
    slug: z.string(),
    name: z.string(),
    version: z.string(),
    shape: z.enum(["backend", "backend+webapp"]),
    basePath: z.string(),
    httpUrl: z.string(),
    socketPath: z.string().optional(),
    hostId: z.string().optional(),
    capabilities: z.array(z.string()),
    manifest: z.unknown(),
  }),
  response: z.object({ ok: z.literal(true) }),
});

const listApps = defineEndpoint({
  name: "listApps",
  method: "GET",
  path: "/registry/apps",
  auth: "session-or-apiKey",
  description: "Lists every app currently registered with TwoDB.",
  response: z.array(z.object({ slug: z.string(), name: z.string(), basePath: z.string(), status: z.string() })),
});

const getAppManifest = defineEndpoint({
  name: "getAppManifest",
  method: "GET",
  path: "/registry/apps/:slug/endpoint.json",
  auth: "session-or-apiKey",
  description: "Returns one app's cached endpoint.json, as last reported at registration time.",
  request: z.object({ slug: z.string() }),
});

const provisionApp = defineEndpoint({
  name: "provisionApp",
  method: "POST",
  path: "/registry/apps/:slug/provision",
  auth: "session",
  description:
    "Creates (or rotates) a Postgres role+schema for the named app. Returns the connection string exactly once.",
  request: z.object({ slug: z.string() }),
  response: z.object({ schema: z.string(), role: z.string(), connectionString: z.string() }),
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
    "The control plane: app registry/self-registration, Postgres schema provisioning, identity (TwoAuth), " +
    "and the Gateway every other app's traffic flows through.",
  capabilities: [],
  coreDeps: ["core-data", "core-platform", "core-async"],
  basePath: "/",
  endpoints: [registerApp, listApps, getAppManifest, provisionApp, search, proxy],
});

export default twodbManifest;
