# twodb

Turborepo monorepo managed with pnpm workspaces.

## Projects

| Path                | Name               | Description                                              | Port |
| ------------------- | ------------------ | -------------------------------------------------------- | ---- |
| `apps/web`          | `twodb-web-app`    | Main React + Vite web app                                | 5173 |
| `apps/ui-library`   | `twodb-ui-library` | Storybook-like showcase for UI components                | 5174 |
| `apps/api`          | `twodb-api`        | Fastify (TS) backend — Postgres + Memgraph + sqlite      | 3001 |
| `packages/ui`       | `@twodb/ui`        | Shared React component library                           | —    |
| `packages/contracts`| `@twodb/contracts` | Shared DTOs + event maps (pure types)                    | —    |
| `packages/shared-*` | `@twodb/shared-*`  | Frontend/backend plugin kits                             | —    |
| `plugins/*`         | `@twodb/*`         | Feature plugins (view + service). Not mounted at boot —  | —    |
|                     |                    | will be loaded via the admin plugin registry             |      |

## Getting started

```sh
pnpm install
pnpm --filter twodb-api db:up   # postgres + memgraph (+ s3) via docker compose
pnpm dev                        # runs all apps in parallel via turbo
```

Run a single app:

```sh
pnpm --filter twodb-web-app dev
pnpm --filter twodb-ui-library dev
pnpm --filter twodb-api dev
```

## Admin

`/admin` is a standalone surface (outside the app shell) backed by
`/api/admin/*` on the api. Highlights:

- **Passkey-only auth** (WebAuthn) — no emails or passwords. When zero
  passkeys exist, registration is open (bootstrap); afterwards everything
  requires an admin session. The last passkey can never be deleted.
- **Instance** — one row identifying the deployment (`inst-…` id via
  `newId`), created at first boot.
- **Plugin registry** — plugins are registered by identifier
  (`git:<url>` or `npm:<name>`); fetching/loading lands later.

State lives in an api-owned sqlite database at
`$TWO_DB_WORK_DIR/db-v1.sqlite` (default `../../../.work`, resolved from
`apps/api/src`). Migrations are Kysely modules in
`apps/api/src/db/migrations/`, registered in `index.ts`, applied at boot.

See `apps/api/src/admin/plan.md` for the design.

### HTTPS dev (WebAuthn over LAN)

Passkeys need a secure context: `http://localhost` works, LAN IPs/hostnames
over plain http don't. To browse from another machine:

```sh
TWODB_WEB_HTTPS=1 pnpm --filter twodb-web-app dev
```

A self-signed cert (SANs: localhost, hostname, hostname.local, LAN IPs) is
generated into `.work/certs/`. Set `TWODB_ADMIN_RP_ID` (must be a hostname,
not an IP) and `TWODB_ADMIN_ORIGIN` in `.env` to match the URL you browse,
e.g. `divine.local` / `https://divine.local:5173`. Delete `.work/certs/` if
your LAN IP changes.

## Docker

CI (`.github/workflows/docker-image.yaml`) builds and pushes two images to
GHCR on every push to `main`:

- `ghcr.io/<repo>` — server (api + web), from the root `Dockerfile`
- `ghcr.io/<repo>-node-agent` — node agent, from `apps/node/Dockerfile`

Run the server:

```sh
docker run -p 3001:3001 -v twodb-data:/data \
  -e DATABASE_URL=postgres://twodb:twodb@host:5432/twodb \
  -e MEMGRAPH_URL=bolt://host:7687 \
  ghcr.io/reezpatel/twodb:latest
```

`/data` holds the sqlite admin database — mount a volume to keep it.

## Nix

The repo ships a flake with a package and a NixOS module:

```nix
# in your NixOS configuration flake
inputs.twodb.url = "github:reezpatel/twodb";

# configuration
imports = [ inputs.twodb.nixosModules.default ];
services.twodb = {
  enable = true;
  environment = {
    DATABASE_URL = "postgres://twodb:twodb@localhost:5432/twodb";
    MEMGRAPH_URL = "bolt://localhost:7687";
    TWODB_ADMIN_RP_ID = "divine.local";
    TWODB_ADMIN_ORIGIN = "https://divine.local:5173";
  };
};
```

State lives in `/var/lib/twodb` (systemd `StateDirectory`). Also available:
`nix build .#twodb`, `nix develop` (node + pnpm shell).

Note: when `pnpm-lock.yaml` changes, regenerate the `pnpmDeps` hash in
`nix/package.nix` (build once and copy the `got:` hash from the error).

## Using UI components

Both `apps/web` and `apps/ui-library` consume components from `@twodb/ui`:

```tsx
import { Button, Card, Input, Badge } from "@twodb/ui";
```

Add a new component in `packages/ui/src/components/`, export it from
`packages/ui/src/index.ts`, and register a showcase entry in
`apps/ui-library/src/registry.tsx`.

---

[ TWO_DB_CONTROLLER ] -> Frontend, API

- [ TWO_DB_NODE ] -> Role: StorageProvider - Providers storages, nodes balances themselves
  - Role: ExecutionProvider - Provides a surface to execute code and host code
  - Role: JobProvider - Provides runner to execute jobs.. (serverless env)
