# AGENTS.md — TwoThing

Personal inventory management. **Implemented** — read `README.md` first for the
feature map and file layout.

## Invariants (don't break these)
- Label codes are allocated ONLY through `src/lib/code-pool.ts`
  (`generateCodes` / `autoCode`). Never insert into `tt_code` with a code that
  is on an item/place or was generated within `REISSUE_WINDOW_DAYS`. Tests in
  `src/lib/code-pool.test.ts` must stay green.
- Every user-typed/scanned code goes through `normalizeCode()` before lookup
  or storage; non-matching input is a foreign (manufacturer) barcode.
- All stock/location changes write `tt_activity` (see `src/lib/activity.ts`).
- Webapp: anything that changes data calls `refreshAll()` (or `invalidate`)
  from `webapp/src/lib/actions.ts` / `query.ts` so every open view updates.
- `TWOTHING_DEV_WORKSPACE` is a dev-only identity fallback; the server refuses
  to boot with it in production.

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
- One Postgres schema, named `twothing`, provisioned by TwoDB
  (the control plane (`GET /registry/config`, via twodb-core)) — access it only via
  `@twodb/core-data/db`'s `createPgDb()`.
- On boot call `connectTwoDb({ manifest, httpUrl })` from `@twodb/twodb-core` (see
  `apps/twoday/src/index.ts`): it registers with the control plane, pings every 10s
  (30s of silence = inactive) and returns the app's Postgres/S3 config — never put
  `DATABASE_URL`/S3 settings in env. Use `twodb.gatewayFetch()` for calls to other
  apps; requests arriving via the gateway carry `x-gateway-verified`.

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
