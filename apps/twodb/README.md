# TwoDB (control plane + Gateway)

The front door of the whole ecosystem: identity (TwoAuth), the app
registry (self-registration), Postgres schema/role provisioning, and the
Gateway every other app's traffic is proxied through.

## Run locally
```bash
cp .env.example .env   # fill in TWODB_PG_ADMIN_URL, AUTH_SECRET at minimum
pnpm --filter @twodb/app-twodb dev
```
On first run it bootstraps its own control-plane SQLite file
(`TWODB_SQLITE_FILE`, default `./.data/twodb-control-plane.sqlite`) —
including better-auth's own tables via `migrateAuthEngine()` — no separate
`npx @better-auth/cli migrate` step needed. Postgres is only touched when
you actually provision an app's schema
(`POST /registry/apps/:slug/provision`).

## What lives where
```
src/
├── config.ts              env schema (core-data/config)
├── db/
│   ├── sqlite.ts            control-plane DB bootstrap (org/workspace/space + registered_app table)
│   ├── registry.ts          app registry repository
│   └── provisioning.ts      Postgres schema+role provisioning (TwoDB-only logic)
├── auth/index.ts            wires core-platform/auth's engine + workspace repo
├── gateway/
│   ├── server.ts             fastify app: all routes
│   ├── proxy.ts               generic streaming reverse proxy to a registered app
│   ├── federated-search.ts    search capability fan-out
│   └── web-request.ts         Fastify <-> Fetch API Request/Response adapters
├── manifest.ts              TwoDB's own declarative endpoints (→ ENDPOINTS.md)
└── messages.ts               TwoDB's own broadcast events (→ MESSAGES.md)
webapp/                      admin frontend (login, registry, workspace/space mgmt)
```

## How other apps plug in
1. On boot, an app calls `registerWithGateway(manifest, opts)` from
   `@twodb/core-platform/manifest` — this is `POST /registry/register`
   under the hood, guarded by a shared `x-provision-token` (== `AUTH_SECRET`
   for now; swap for mTLS/network isolation before any real multi-host
   deployment).
2. Everything that app's frontend or other apps need from it flows through
   `GET/POST/... /apps/:slug/*` on the Gateway — never a direct connection.
3. The Gateway resolves the caller's identity once (session or workspace API
   key) and forwards it as `x-twodb-*` headers; the target app trusts those
   headers rather than re-verifying auth itself.

See `ENDPOINTS.md` / `MESSAGES.md` (generated — run `pnpm gen:docs`) for the
exact header/payload contracts.

## Known stubs / not hardened yet
- Provisioning guard is a shared-secret header, not mTLS/ACL.
- Encrypted Postgres credentials are AES-256-GCM keyed off `AUTH_SECRET` —
  fine for self-hosted/dev, replace with a real secrets manager before any
  serious multi-tenant deployment.
- Docker orchestration (install/upgrade apps via docker-compose) is not
  wired up yet — provisioning only covers the Postgres side so far.
- `messages.ts`'s `twodb.app.registered` event is declared for docs but not
  yet actually published on registration — wire it up when the first real
  consumer (e.g. an admin-UI activity feed) needs it.
