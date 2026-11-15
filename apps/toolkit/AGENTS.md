# AGENTS.md — Toolkit

Central host for external MCP servers + API connectors. Read `README.md` first.

## Before writing any route
- Add a `defineEndpoint(...)` to `src/manifest.ts` first (request/response
  Zod schemas + description) — this is the single source of truth
  `ENDPOINTS.md`/`endpoint.json` are generated from. Write the Fastify
  route to match it, not the other way around.
- This app only ever talks to other apps **through the Gateway**
  (`apps/twodb`) — never import `@twodb/core-platform/transport` or dial
  another app's URL directly.
- Identity arrives pre-resolved as `x-twodb-*` headers forwarded by the
  Gateway — never talk to better-auth or the org/workspace/space tables
  yourself.
- One Postgres schema, named `toolkit`, provisioned by TwoDB — access it only
  via `@twodb/core-data/db`'s `createPgDb()`.
- On boot call `connectTwoDb({ manifest, httpUrl })` from `@twodb/twodb-core`:
  it registers with the control plane, pings every 10s and returns the app's
  Postgres/S3 config — never put `DATABASE_URL`/S3 settings in env.
- Connector secrets (API keys) are AES-256-GCM encrypted at rest
  (`src/crypto.ts`, keyed off TWODB_DATA_KEY) and never returned in plaintext —
  the API masks them (`••••••••`); a masked value in an update request keeps
  the stored secret.

## Connector framework
- Templates live in `src/connectors/` and are code-owned
  (`registry.ts` is the single list). A template declares fields, commands,
  broadcast events, an optional `poll()` + interval, and a `healthCheck`.
- All broadcast fan-out goes through `publishBroadcast` in `server.ts`:
  broadcast log row → pg_notify (`toolkit.connector.event`) → durable queue
  inserts → SSE push. Never emit directly.
- The poller (`src/poller.ts`) ticks every 15s and runs each enabled
  instance's `poll()` when its template interval elapsed. First poll run
  baselines state (no events) so creating an instance doesn't spam.

## Messaging
Events are declared in `src/messages.ts` via `@twodb/core-async/registry` —
run `pnpm gen:docs` after changes.

## Frontend
Follow `blocks/CONVENTIONS.md` exactly: one component per file,
`partials/` = dumb UI only, `hooks/` = all business logic with one holding
hook per component.
