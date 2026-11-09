# @twodb/core-platform

Four independently-importable concerns:

## `manifest`
`defineEndpoint()` / `defineAppManifest()` — the single declarative source
every app writes once. `writeManifestArtifacts(manifest, outDir)` generates
**both** `endpoint.json` (machine-readable, consumed by `twodb-cli` and the
Gateway) and `ENDPOINTS.md` (human/agent-readable projection) from the same
Zod schemas — they can never drift from each other because they're produced
by the same call.

## `auth` (TwoAuth)
- `schema.ts` / `applyAuthPlatformSchema(db)` — Org → Workspace → Space +
  workspace membership + workspace-level API keys. Portable across the
  Postgres/SQLite Kysely dialects.
- `repository.ts` / `createWorkspacePlatform(db)` — CRUD + API key issuance
  (`issueApiKey`, returns the raw key exactly once) and verification.
- `engine.ts` / `createAuthEngine(options)` — wraps `better-auth` configured
  passwordless: passkeys (`@better-auth/passkey`), Google (social provider),
  PocketID or any OIDC provider (`genericOAuth` plugin), workspace API keys
  (`@better-auth/api-key`), bearer tokens for native/desktop shells.
- `context.ts` / `resolveAuthContext(...)` — the one function the Gateway
  calls to turn request headers into a normalized `AuthContext`, whether the
  caller used a session cookie/bearer token or a workspace API key.

**Only `apps/twodb` runs this.** Every other app receives an already-resolved
`AuthContext` forwarded by the Gateway — they never talk to better-auth or
the org/workspace/space tables directly.

## `transport` — Gateway-internal only
`createDialer()` / `pickTransport()` — how the Gateway reaches a registered
app: unix domain socket when co-located on the same host (fastest), TCP/HTTP
otherwise. No app outside `apps/twodb` imports this.

## `telemetry`
`createLogger(appSlug)` (pino) and a tiny in-memory `createMetrics()` counter
— enough for TwoDB's admin UI to show cross-app health today. Swap for a
real metrics backend only when a concrete need shows up.
