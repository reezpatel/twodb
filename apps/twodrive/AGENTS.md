# AGENTS.md — TwoDrive

Drive/file explorer over storage backends (S3-compatible or local) with
virtual storages, an internal app-file API, and an S3-compatible surface.
**Implemented (v1)** — see README.md for the feature map and known gaps.

## Before writing any route
- Add a `defineEndpoint(...)` to `src/manifest.ts` first (request/response
  Zod schemas + description) — this is the single source of truth
  `ENDPOINTS.md`/`endpoint.json` are generated from. Write the Fastify
  route to match it, not the other way around.
- This app only ever talks to other apps **through the Gateway**
  (`apps/twodb`) — never import `@twodb/core-platform/transport` or dial
  another app's URL directly.
- Identity arrives pre-resolved as `x-twodb-*` headers forwarded by the
  Gateway (see `src/gateway-context.ts`) — never talk to better-auth or the
  org/workspace/space tables yourself.
- One Postgres schema, named `twodrive`, provisioned by TwoDB
  (the control plane (`GET /registry/config`, via twodb-core)) — access it only via
  `@twodb/core-data/db`'s `createPgDb()`.
- Call `registerWithGateway(manifest, opts)` from
  `@twodb/core-platform/manifest` on boot (see `src/index.ts`).

## App-specific contracts
- **The central `drive_entry` table is the source of truth.** Backends are
  dumb storage — never list them to answer file reads. All writes go
  through `src/lib/store.ts` so tracking stays consistent.
- **Backend secrets** (S3 secretAccessKey) are AES-256-GCM encrypted inside
  the config JSON (`src/crypto.ts`, keyed off `TWODB_DATA_KEY`). Never
  return them via the API.
- **App-file API**: callers send `x-twodb-app` (friendly id). Resolution:
  per-app override row → workspace default (the `__default__` sentinel row
  in `drive_app_override`) → `409 no_default_storage`. App folders are
  `<appId>/` inside the resolved virtual storage.
- **S3 surface** (`/s3/:storageId`) is access-key scoped (simplified auth,
  NOT SigV4) — auth there does NOT use gateway headers.

## Frontend
Follow `blocks/CONVENTIONS.md` exactly: one component per file,
`partials/` = dumb UI only, `hooks/` = all business logic with one holding
hook per component. Don't add anything to `blocks/` speculatively.

## Messaging
If this app needs background jobs or cross-app notifications, declare them
in `src/messages.ts` via `@twodb/core-async/registry`'s `defineJob`/
`defineBroadcastEvent`.
