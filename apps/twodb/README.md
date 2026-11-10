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
   stored) plus a **stable per-app data key** (`TWODB_DATA_KEY` — never
   rotated; apps use it for their own encryption at rest, so it must
   survive upgrades), build/pull the app's Docker image, and start the
   container on `twodb-net` with token + connection string + data key
   injected as env.
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

Lifecycle endpoints: `start`, `stop`, `restart`, `upgrade` (re-resolves the
image, rotates the token, keeps the same DB schema), `DELETE` (removes the
container + registry row; deliberately does NOT drop the Postgres schema).

## Versions & image sources

Releases are driven by a **single git tag for the whole repo** — push
`vX.Y.Z` and CI (`.github/workflows/release-app.yml`) publishes the Docker
image of every app whose code changed since the previous tag as
`ghcr.io/<owner>/app-<slug>:X.Y.Z` (+ `:latest`). Apps that didn't change
aren't released, so per-app versions can lag behind — that's fine. Changes
to shared code (`core/`, `blocks/`, the Dockerfile, the lockfile) release
every app. Nothing builds or publishes on `main` pushes.

Where an install gets its image depends on `TWODB_APP_IMAGE_REGISTRY`:
- **Unset** (monorepo dev default) → built locally from the workspace
  checkout via `deploy/docker/app.Dockerfile`, tagged
  `twodb/<slug>:<package.json version>` (package.json only labels local
  builds — the release version comes from the git tag).
- **Set** (e.g. `ghcr.io/youruser`) → pulled from
  `<registry>/app-<slug>:<version ?? latest>` — the images CI released.

Both `install` and `upgrade` accept an optional `{ "version": "X.Y.Z" }`
body. The installed version + image ref are recorded and visible via
`GET /orchestrator/apps/:slug/status`.

## Local dev without Docker

The same primitives are exposed individually for running an app via
`pnpm dev` instead of as a container:

```bash
# one-time, with a session or workspace API key:
curl -X POST -H "x-api-key: $KEY" $GW/orchestrator/apps/tworoute/provision-db   # → DATABASE_URL
curl -X POST -H "x-api-key: $KEY" $GW/orchestrator/apps/tworoute/issue-token    # → TWODB_PROVISION_TOKEN

DATABASE_URL=... TWODB_PROVISION_TOKEN=... TWODB_GATEWAY_URL=http://localhost:6400 \
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
webapp/                        admin frontend (passkey login, gateway explorer — Swagger-style
                               endpoint/messages browser with try-it, app lifecycle controls)
```

## Deploying (NixOS)

`deploy/nix/twodb-apps.nix` is a flake-parts module that runs the whole
apps cluster on a server: a dedicated Postgres container, and the control
plane itself as a container (`ghcr.io/reezpatel/app-twodb:latest`) that
orchestrates sibling app containers through the host's docker/podman
socket. In that mode the gateway and the apps talk to each other by
container name on the shared `twodb-net` network — set
`TWODB_APP_HTTP_URL_TEMPLATE=http://twodb-app-{slug}:{containerPort}` and
`TWODB_APP_PUBLISH_PORTS=false` (the module does this for you).

For the image to orchestrate, it bundles the static `docker` CLI and the
built admin webapp is served from the same origin (both handled by
`deploy/docker/app.Dockerfile` when `APP_PKG=@twodb/app-twodb`).

## Port assignments

Fixed per app (see `src/orchestrator/catalog.ts`) so installs are
reproducible and a host-run dev stack never collides with containers.
Everything lives in the 64XX/65XX band: TwoDB (control plane + gateway)
6400; installable apps 6401+ sequentially — `tworoute` 6401, `twomail` 6402,
`twoday` 6403, `twocontacts` 6404, `twochat` 6405, `twodrive` 6406,
`artisan` 6407, `dispatch` 6408, `tworing` 6409, `garden` 6410,
`twothing` 6411, `twoloop` 6412, `membrain` 6413, `paintress` 6414,
`twopin` 6415, `twodoo` 6416 (6417–6499 reserved); dev webapps 6500 (twodb)
and 6501+ (scaffolded apps); storybooks 6520+. `pnpm local` at the repo
root boots all of it via turbo.

## How other apps plug in (once installed)
1. Everything an app's frontend or other apps need from it flows through
   `GET/POST/... /apps/:slug/*` on the Gateway — never a direct connection.
2. The Gateway resolves the caller's identity once (session or workspace
   API key) and forwards it as `x-twodb-*` headers; the target app trusts
   those headers rather than re-verifying auth itself.

See `ENDPOINTS.md` / `MESSAGES.md` (generated — run `pnpm gen:docs`) for
the exact header/payload contracts.

## Known stubs / not hardened yet
- Registry pulls assume the images are public or the host's docker daemon is
  already logged in — there's no `TWODB_REGISTRY_TOKEN` handling yet.
- Container status is only refreshed on demand (`GET .../status` or the
  webapp's per-row polling) — no background reconciler yet, so a container
  that crashes outside TwoDB's own start/stop calls won't be noticed until
  someone polls.
- Encrypted Postgres credentials and per-app data keys are AES-256-GCM
  keyed off `AUTH_SECRET` — fine for self-hosted/dev, replace with a real
  secrets manager before any serious multi-tenant deployment.
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
