# AGENTS.md — TwoDB (control plane + Gateway)

Read `README.md` first, then `ENDPOINTS.md` / `MESSAGES.md` (generated —
regenerate with `pnpm gen:docs` after touching `src/manifest.ts` or
`src/messages.ts`; never hand-edit the generated files directly).

## This app is special
TwoDB is the only app allowed to:
- import `@twodb/core-platform/auth`'s `engine.ts`/`schema.ts` directly
  (every other app only ever sees a resolved `AuthContext` forwarded via
  `x-twodb-*` headers);
- import `@twodb/core-platform/transport` (every other app talks HTTP only,
  dialed *by* the Gateway, never dialing anything itself);
- do Postgres provisioning DDL (`src/db/provisioning.ts`) — `core-data/db`
  stays a pure runtime client everywhere else;
- shell out to `docker` (`src/orchestrator/docker.ts`) — apps never manage
  their own containers.

If you're building a new app and find yourself wanting any of the above,
stop — add an endpoint to TwoDB instead and have the new app call it
through the Gateway like everyone else.

## The registration trust model (read before touching orchestrator/)
- There is NO shared registration secret. `POST /registry/register` is
  guarded by per-app tokens TwoDB generates at install time; only the
  token's sha256 hash is stored (`registered_app.registration_token_hash`),
  and the plaintext is injected into the app's env as
  `TWODB_PROVISION_TOKEN` (or returned once by `issue-token` for dev mode).
- Two registration paths must BOTH keep working: push (the app calls
  `registerWithGateway()` — primary for host-run dev apps) and pull (TwoDB
  polls the container's published port for `GET /internal/manifest` —
  required for containerized apps, because container→host traffic is
  firewalled on stock Linux Docker). The shared contract lives in
  `core-platform/src/manifest/serve.ts`; both paths end in
  `registry.completeRegistration()`.
- When a containerized app's boot fails to push-register, that is expected
  on firewalled hosts and logged as non-fatal — do not "fix" it by making
  the app crash-retry.

## Before changing `gateway/server.ts`
- Every route must resolve an `AuthContext` via `resolveContext()` *unless*
  it's explicitly public (currently only `/registry/register`, which is
  guarded by the per-app registration token instead).
- Lifecycle routes that run docker builds (`install`, `upgrade`) must stay
  async via `runLifecycle()` — never hold the HTTP request open for a
  multi-minute build; clients poll `GET /orchestrator/apps/:slug/status`.
- Keep `src/manifest.ts` in sync with whatever routes you add — it's the
  only source `ENDPOINTS.md`/`endpoint.json` are generated from, and
  `twodb-cli` relies on it to expose TwoDB's own routes as commands too.
- Streaming responses must go through `sendWebResponse()` (it uses
  `reply.hijack()` + manual chunk writes) — don't `return` a stream value
  directly from a Fastify handler, it won't stream.

## Testing locally without real PocketID/Google
- Passkeys work without any external provider — register one via the
  better-auth passkey flow in the webapp and that's enough to exercise the
  whole auth path end-to-end.
- Google/PocketID env vars are optional (see `src/config.ts`) — omit them
  and those sign-in options just don't appear.
- For headless testing (curl/scripts), boot TwoDB once, then run
  `tsx scripts/seed-test-identity.ts` — it seeds a throwaway
  org/workspace and prints a workspace API key usable as `x-api-key`.
