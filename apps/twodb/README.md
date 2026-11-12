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

## How apps register (the trust model)

**Registration is always app-initiated.** There is no pull-registration and
no `/internal/manifest` anymore. An app (TwoDB-managed container or one you
run yourself) uses `@twodb/twodb-core`'s `connectTwoDb()` on boot:

1. **Authenticate.** Either with an *app token* (`TWODB_APP_TOKEN`) or with
   the shared `TWODB_REGISTRATION_SECRET`, which mints a token on the fly.
   - **Managed** (TwoDB runs the container): the orchestrator mints a
     **non-expiring** token (only its sha256 is stored in `app_token`) and
     injects `TWODB_APP_TOKEN` + `TWODB_APP_SLUG`. Rotated on every
     install/upgrade, or from the UI ("Rotate token" on the app card).
   - **Unmanaged** (you run it): set `TWODB_REGISTRATION_SECRET` (same value
     the control plane has). `POST /registry/register` returns a **30-day**
     token (`TWODB_APP_TOKEN_TTL_DAYS`), cached by twodb-core in
     `.twodb/<slug>.token`; when it expires/is revoked the app re-registers
     with the secret. `POST /registry/apps/:slug/tokens` (session) mints one
     by hand.
2. **Register** — `POST /registry/register` (slug, httpUrl, manifest).
3. **Heartbeat** — `POST /registry/ping` every **10s**; **30s** of silence
   (`TWODB_HEARTBEAT_TIMEOUT_MS`) marks the app `inactive`.
4. **Fetch config** — `GET /registry/config` returns the app's Postgres
   connection (schema + role, provisioned on first call), its S3 location
   (global bucket + `<slug>/` prefix) and its stable data key. Apps carry no
   `DATABASE_URL`/S3 env. Credentials are **stable**: registering or
   re-fetching never changes them (only `provision-db {rotate:true}` does).

### What the gateway does with callers
Every request may carry `x-twodb-app: <slug>` + `x-twodb-token: <token>`.
The gateway validates them against `app_token`, **always strips
`x-twodb-token`**, and sets `x-gateway-verified: true|false` (an inbound
value of that header is never trusted); a verified call also forwards
`x-twodb-app`. `twodb-core`'s `callerApp(headers)` reads this on the app side.

### User vs machine requests
Any path with an `internal` segment (`/internal/…`, `/apps/<slug>/internal/…`,
incl. WebSocket upgrades) is **user-session only**: workspace API keys and app
tokens get `403`, anonymous `401`. Token rotation, token minting and
storage admin endpoints are session-only too.

### Login with TwoDB
Webapps use `@twodb/twodb-shared-frontend` (`<TwoDbAuthProvider>` +
`<RequireTwoDbAuth>` → "Login using TwoDB" button). Flow: authorization code
+ PKCE (S256) — app webapp → TwoDB webapp `/authorize` → one-time code
(`POST /registry/oauth/authorize`, 60s, hashed, single use) →
`POST /registry/oauth/token` → a session token the gateway accepts as
`Authorization: Bearer` (WebSocket/EventSource use `?access_token=`, which the
gateway promotes to the header and strips). Allowed redirect origins:
`AUTH_TRUSTED_ORIGINS`, any port 6500–6599 on the same host, plus
`TWODB_LOGIN_REDIRECT_ORIGINS`.

### Storage (S3)
One global bucket configured on the control plane via `TWODB_S3_*` (like
`TWODB_PG_ADMIN_URL`); each app gets its own key prefix and the shared
credentials from `GET /registry/config`. There is no UI for it.

### Managed lifecycle
`POST /orchestrator/apps/:slug/install` (async): provision the app's Postgres
schema+role, mint the managed token, build/pull the image, start the container
on `twodb-net` with only `TWODB_APP_TOKEN`, `TWODB_APP_SLUG`,
`TWODB_GATEWAY_URL`, `HTTP_URL`, `PORT` injected — then wait for the app to
register itself. Also `start`, `stop`, `restart`, `upgrade`, `DELETE` (removes
container + registry row + tokens; does NOT drop the Postgres schema).

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
