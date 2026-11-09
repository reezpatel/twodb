# TwoDB (control plane + Gateway)

The front door of the whole ecosystem: identity (TwoAuth), Docker-based app
installation/lifecycle management, per-app registration tokens, Postgres
schema/role provisioning, and the Gateway every other app's traffic is
proxied through.

## Run locally
```bash
cp .env.example .env   # fill in TWODB_PG_ADMIN_URL, AUTH_SECRET at minimum
pnpm --filter @twodb/app-twodb dev
```
On first run it bootstraps its own control-plane SQLite file
(`TWODB_SQLITE_FILE`, default `./.data/twodb-control-plane.sqlite`) —
including better-auth's own tables via `migrateAuthEngine()` — no separate
`npx @better-auth/cli migrate` step needed.

## How apps get installed (the trust model)

There is **no shared registration secret**. Apps don't self-install — TwoDB
(the admin) installs them:

1. `POST /orchestrator/apps/:slug/install` (session/API-key auth) kicks off
   an async lifecycle: provision the app's Postgres schema+role, generate a
   **unique per-app registration token** (only its sha256 hash is ever
   stored), build the app's Docker image (`deploy/docker/app.Dockerfile`),
   and start the container on `twodb-net` with the token + connection
   string injected as env.
2. TwoDB then **pull-registers**: it polls the container's published port
   for `GET /internal/manifest` with the token and completes registration
   in-process. (Containers on firewalled Linux hosts can't reach TwoDB at
   all — container→host INPUT is dropped — so the app's own push
   registration via `registerWithGateway()` can't be the only path. Push
   still works and remains the primary path for apps running directly on
   the host, i.e. local dev.)
3. Poll `GET /orchestrator/apps/:slug/status` until `installStatus` is
   `running` and `registrationStatus` is `active`.

A stolen token only ever impersonates the one slug it was issued for, and
every install/upgrade rotates it.

Lifecycle endpoints: `start`, `stop`, `restart`, `upgrade` (rebuilds the
image, rotates the token, keeps the same DB schema), `DELETE` (removes the
container + registry row; deliberately does NOT drop the Postgres schema).

## Local dev without Docker

The same primitives are exposed individually for running an app via
`pnpm dev` instead of as a container:

```bash
# one-time, with a session or workspace API key:
curl -X POST -H "x-api-key: $KEY" $GW/orchestrator/apps/tworoute/provision-db   # → DATABASE_URL
curl -X POST -H "x-api-key: $KEY" $GW/orchestrator/apps/tworoute/issue-token    # → TWODB_PROVISION_TOKEN

DATABASE_URL=... TWODB_PROVISION_TOKEN=... TWODB_GATEWAY_URL=http://localhost:4000 \
  pnpm --filter @twodb/app-tworoute dev
```
The dev-mode app push-registers itself on boot (host → localhost works
fine). `scripts/seed-test-identity.ts` mints a throwaway workspace API key
for exactly this kind of headless testing.

## What lives where
```
src/
├── config.ts                env schema (core-data/config)
├── db/
│   ├── sqlite.ts              control-plane DB bootstrap (incl. better-auth tables)
│   ├── registry.ts            app registry repository (token hashes, container state)
│   └── provisioning.ts        Postgres schema+role provisioning + AES-256-GCM secret helpers
├── orchestrator/
│   ├── catalog.ts             static installable-app catalog + fixed port assignments
│   ├── docker.ts              thin docker CLI wrapper (never string-interpolates args)
│   ├── tokens.ts              per-app registration token generation
│   └── install.ts             install/start/stop/restart/upgrade/remove + pull-registration
├── auth/index.ts              wires core-platform/auth's engine + workspace repo
├── gateway/
│   ├── server.ts               fastify app: all routes
│   ├── proxy.ts                generic streaming reverse proxy to a registered app
│   ├── federated-search.ts     search capability fan-out
│   └── web-request.ts          Fastify <-> Fetch API Request/Response adapters
├── manifest.ts                TwoDB's own declarative endpoints (→ ENDPOINTS.md)
└── messages.ts                 TwoDB's own broadcast events (→ MESSAGES.md)
webapp/                        admin frontend (login, registry, workspace/space mgmt)
```

## Port assignments

Fixed per app (see `src/orchestrator/catalog.ts`) so installs are
reproducible: `tworoute` 4010, `twomail` 4011, `twoday` 4012,
`twocontacts` 4013, `twochat` 4014, `twodrive` 4015, `artisan` 4016,
`dispatch` 4017, `tworing` 4018, `garden` 4019, `twothing` 4020,
`twoloop` 4021, `membrain` 4022, `paintress` 4023, `twopin` 4024,
`twodoo` 4025. TwoDB itself stays on 4000.

## How other apps plug in (once installed)
1. Everything an app's frontend or other apps need from it flows through
   `GET/POST/... /apps/:slug/*` on the Gateway — never a direct connection.
2. The Gateway resolves the caller's identity once (session or workspace
   API key) and forwards it as `x-twodb-*` headers; the target app trusts
   those headers rather than re-verifying auth itself.

See `ENDPOINTS.md` / `MESSAGES.md` (generated — run `pnpm gen:docs`) for
the exact header/payload contracts.

## Known stubs / not hardened yet
- Encrypted Postgres credentials are AES-256-GCM keyed off `AUTH_SECRET` —
  fine for self-hosted/dev, replace with a real secrets manager before any
  serious multi-tenant deployment.
- The Docker image build copies the whole workspace into the image rather
  than pruning to the app's dependency closure — revisit if image
  size/build time become a real problem.
- The app catalog is a static in-repo list, not a remote registry.
- Container status is only refreshed on demand (`GET .../status`) — no
  background reconciler yet, so a container that crashes outside TwoDB's
  own start/stop calls won't be noticed until someone polls.
- `messages.ts`'s `twodb.app.registered` event is declared for docs but not
  yet actually published on registration — wire it up when the first real
  consumer (e.g. an admin-UI activity feed) needs it.
