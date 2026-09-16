# Node fleet — plan

The `code` plugin is now the **node** plugin (`io.twodb.node`, `@twodb/node`,
`plugins/node/`). Nodes are child agents (`apps/node`) that register against
the controller over the WS gateway (`/api/v1/io.twodb.node/nodes/ws`), auth
with per-node secrets, and stream heartbeats (meta + resource stats).

## A. Node management UI — `plugins/node/view`

Fleet dashboard to manage nodes and see liveness. The existing API is the
contract (`plugins/node/service/routes/`):

- `GET /nodes` · `POST /nodes` (returns secret **once**) · `GET /nodes/:id`
- `PATCH /nodes/:id` (rename) · `DELETE /nodes/:id`
- `POST /nodes/:id/secrets` · `DELETE /nodes/:id/secrets/:secretId`

DTOs: `NodeDto`, `NodeSecretDto`, `NodeStatus` in `plugins/node/shared/types.ts`.
`last_heartbeat` carries `NodeHeartbeatDetails` (cpus, loadavg, memory, uptime,
activeJobs, idle/busy) — surface it.

Deliverables:

1. `NodesScreen` (fleet table) mounted at `/node`; the workspace scene
   lives in the separate `@twodb/code` plugin at `/code`.
2. Live status: poll `GET /nodes` (tanstack-query, short `refetchInterval`),
   derive online/offline + heartbeat age.
3. Create-node flow: name → `POST /nodes` → show secret once (copy button).
4. Node detail drawer: rename (tanstack-form), resource snapshot, secrets
   (create/revoke), delete with confirm.
5. Conventions: `ApiClient` from `@twodb/shared-frontend`, business logic in
   `use-*.hook.ts` hooks, styled-jsx sibling `.style.jsx` files (`node-`
   prefix), design tokens only, declare tanstack deps in
   `plugins/node/package.json` (as `plugins/agent` does).

## B. Containerize `apps/node` + CI/CD

1. `apps/node/Dockerfile` — multi-stage pnpm workspace build (root Dockerfile
   pattern), runtime `pnpm --filter twodb-node start`, non-root user.
2. Fix stale root `Dockerfile` — copies nonexistent `packages/notes`, misses
   all `plugins/*/package.json` (workspace deps of `twodb-api`), so image
   builds fail today. Copy every workspace package.json.
3. `docker-compose.node.yaml` — node-agent service (controller URL, node
   secret env, optional workdir volume).
4. `.github/workflows/docker-image.yaml` — build **two** images (server,
   node-agent → `ghcr.io/<repo>` / `ghcr.io/<repo>-node-agent`), keep
   SHA-pinned actions, GHA cache; add `twodb-node` typecheck to builds.

## Verification

- `pnpm --filter twodb-web-app build` green (covers plugin view).
- `pnpm --filter twodb-node typecheck` green.
- `docker build` both Dockerfiles succeeds locally.
