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
  stays a pure runtime client everywhere else.

If you're building a new app and find yourself wanting any of the above,
stop — add an endpoint to TwoDB instead and have the new app call it
through the Gateway like everyone else.

## Before changing `gateway/server.ts`
- Every route must resolve an `AuthContext` via `resolveContext()` *unless*
  it's explicitly public (currently only `/registry/register`, which uses
  the shared provision-token instead).
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
