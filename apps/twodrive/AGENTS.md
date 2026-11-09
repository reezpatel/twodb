# AGENTS.md — TwoDrive

Drive/file management. **This app is scaffolded, not implemented.** Read `README.md`
first.

## Before writing any route
- Add a `defineEndpoint(...)` to `src/manifest.ts` first (request/response
  Zod schemas + description) — this is the single source of truth
  `ENDPOINTS.md`/`endpoint.json` are generated from. Write the Fastify
  route to match it, not the other way around.
- This app only ever talks to other apps **through the Gateway**
  (`apps/twodb`) — never import `@twodb/core-platform/transport` or dial
  another app's URL directly.
- Identity arrives pre-resolved as `x-twodb-*` headers forwarded by the
  Gateway (see `apps/tworoute/src/gateway-context.ts` for the read-side
  pattern) — never talk to better-auth or the org/workspace/space tables
  yourself.
- One Postgres schema, named `twodrive`, provisioned by TwoDB
  (`POST /registry/apps/twodrive/provision`) — access it only via
  `@twodb/core-data/db`'s `createPgDb()`.
- Call `registerWithGateway(manifest, opts)` from
  `@twodb/core-platform/manifest` on boot (see `apps/tworoute/src/index.ts`).

## Frontend (if this app has a webapp)
Follow `blocks/CONVENTIONS.md` exactly: one component per file,
`partials/` = dumb UI only, `hooks/` = all business logic with one holding
hook per component. Don't add anything to `blocks/` speculatively — only
once a second app needs the same component.

## Messaging
If this app needs background jobs or cross-app notifications, declare them
in `src/messages.ts` via `@twodb/core-async/registry`'s `defineJob`/
`defineBroadcastEvent` — don't reach for Redis/NATS (v1 is Postgres-backed
only, see the architecture decision log).
