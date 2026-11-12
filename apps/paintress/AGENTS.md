# AGENTS.md — Paintress

Miro-like boards (diagram canvas + markdown/mermaid docs) edited by a human
and LLM agents at once. **Implemented in Phase 1** — read `README.md` first.

## Invariants (don't break these)
- **Every item write goes through `store.applyBatch()`** — it is what makes
  undo (stored inverse ops), the event log and live WebSocket fan-out work.
  Never `update items` from a route.
- `src/shared/` is imported by the webapp: keep it free of node/DB imports.
- Positions are **relative to the parent item**; `pinned` means "a human placed
  this" and builders must not move it (unless `relayout`).
- New agent-facing endpoints: manifest entry first, then the route, then
  `pnpm gen:docs`. Run `pnpm test`, `scripts/smoke.ts` and `scripts/ui-check.mjs`.

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
- One Postgres schema, named `paintress`, provisioned by TwoDB
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
