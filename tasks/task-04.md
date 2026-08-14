# Task 4 — Authz engine in @twodb/shared-backend

Plan refs: plan.md §3 (claims, catalog), §5 (grant union), §6 (app/plugin
isolation), §9 (enforcement layers 2–3)
Depends on: task-02 (principal hook, tenancy tables); claim/manifest
primitives from task-01
Status: not started

## Goal

Claims become enforceable. The claim catalog is built at api boot from every
registered manifest, `withWorkspace` resolves the request's workspace context
and effective claims once, and the `requireClaim` / `requireAppClaim`
preHandler factories turn those into plain-language 403s. All of it lives in
`@twodb/shared-backend` so no plugin ever re-implements access logic — and
guests, by construction, hold zero claims unless a grant says otherwise.

## Deliverables

### 4.1 Claim catalog — `packages/shared-backend/src/claims/catalog.ts`

Built once during api boot, after every service plugin has registered:

```ts
type ClaimCatalog = {
  claims: Set<Claim>;                       // every declared claim
  byPlugin: Map<string, Set<Claim>>;        // plugin_id → its claims
  roleDefaults: Map<string, Partial<Record<RoleDefaultKey, Claim[]>>>;
};

async function buildClaimCatalog(manifests: ServiceManifest[]): Promise<ClaimCatalog>;
```

- Collect `permissions` + `roleDefaults` from every registered plugin
  manifest; validate each entry against `PLUGIN_CLAIM_RE` / `APP_CLAIM_RE`
  from task-01 and re-check that `roleDefaults` values are subsets of the
  plugin's own `permissions`. **Unknown shape → boot fails**, never warn.
- Decorate `fastify.claimCatalog`; role APIs (task 5) and the role-editor UI
  (task 9) validate against it.
- `danglingClaims(enabledPluginIds): Claim[]` — given the currently enabled
  set, returns catalog claims whose owning plugin is disabled. The identity
  plugin surfaces these (roles referencing claims of a disabled plugin) as a
  diagnostic; the catalog itself never drops them silently.

### 4.2 `withWorkspace` preHandler — `packages/shared-backend/src/claims/withWorkspace.ts`

Resolves the target workspace **from the route's entity, never from a
client-sent header** — each consuming route declares how to find it (an
entity table + id param, or a direct `workspaceId` param that is then
re-validated against the route's entity row). Loads membership, roles, and
claims in one query and caches the result on the request:

```ts
type WorkspaceContext = {
  workspaceId: string;
  roleClaims: Set<Claim>;       // union over the user's assigned roles
  isMember: boolean;
};

// request.workspaceContext: WorkspaceContext
// request.claims: Set<Claim>  — roleClaims, extended by entity grants in 4.3
```

Effective-claims SQL sketch (role path):

```sql
SELECT rc.claim
FROM workspace_members wm
JOIN role_assignments ra
  ON ra.workspace_id = wm.workspace_id AND ra.user_id = wm.user_id
JOIN roles r            ON r.id = ra.role_id
JOIN role_claims rc     ON rc.role_id = r.id
WHERE wm.workspace_id = $1 AND wm.user_id = $2
UNION
SELECT unnest(eg.claims)            -- entity path, only for entity routes
FROM entity_grants eg
WHERE eg.workspace_id = $1 AND eg.user_id = $2
  AND eg.entity_type = $3 AND eg.entity_id = $4;
```

- No membership row → `isMember: false`, zero claims. **Guests resolve to
  zero claims** unless an `entity_grants` row exists — nothing special-cases
  the guest role; it is simply a role with no `role_claims`.
- A user with roles in workspace A hitting workspace B's route gets B's
  (empty) claim set — cross-workspace leakage is impossible because every
  join is pinned to the resolved `workspace_id`.

### 4.3 `requireClaim` factory — `packages/shared-backend/src/claims/requireClaim.ts`

```ts
fastify.post("/notes", {
  preHandler: [requireClaim("plugin.twodb.notes:note.create")],
}, createNote);

fastify.patch("/notes/:id", {
  preHandler: [
    withWorkspace({ entity: "notes", idParam: "id" }),
    requireClaim("plugin.twodb.notes:note.edit", { entity: "note", idParam: "id" }),
  ],
}, editNote);
```

- Requires `withWorkspace` to have run; missing context → 500 (programmer
  error), not a silent allow.
- Without entity opts: check `request.claims`. With `{ entity, idParam }`:
  union in `entity_grants` for that `(entity_type, entity_id, user)` and
  merge into `request.claims` (cached, once per request) — this is how a
  reader edits one note without a role change.
- Unknown claim (not in `fastify.claimCatalog`) → **throw at route
  registration time**, not at request time.
- Failure → 403 `{ error: "You don't have permission to edit this note." }`
  — plain language, derived from the claim's noun/verb, never the raw claim
  string alone.

### 4.4 `requireAppClaim` factory — same module

`requireAppClaim("app.ledger:entry.create")` resolves the app from the route
(app id param, validated against the `apps` table) and evaluates
`app_role_assignments → app_roles → app_role_claims ∪ entity_grants` for that
(app, user). Hard isolation both ways: `app.*` claims never appear in a
workspace context's claim set and never authorize workspace content;
`plugin.*` claims never authorize app actions. Workspace owner/manager
implicit app-owner (plan §6) lands with the app tables in task 7 — this task
ships the factory against those tables' task-01 DTO shapes, tested with
fakes.

### 4.5 TypeScript decoration typings

In `packages/shared-backend/src/claims/types.d.ts`:

```ts
declare module "fastify" {
  interface FastifyInstance {
    claimCatalog: ClaimCatalog;
  }
  interface FastifyRequest {
    workspaceContext: WorkspaceContext | null;
    claims: Set<Claim>;
  }
}
```

So every service plugin gets typed `request.claims` / `request.workspaceContext`
without importing the authz module directly.

### 4.6 Unit tests — `packages/shared-backend/src/claims/*.test.ts`

Run against a real postgres (testcontainers or the dev compose stack); the
SQL is the feature, so no mocked query layer:

- **Role union** — user with two roles gets the union of both roles' claims.
- **Grant union** — reader + `entity_grants` row for one note can edit that
  note only; a second note still 403s.
- **Guest-zero** — guest membership yields zero claims; a grant on one
  entity yields exactly that entity's claims.
- **Cross-workspace denial** — claims from workspace A do not authorize in
  workspace B.
- **Plugin/app isolation** — `app.ledger:entry.create` fails a
  `requireClaim("plugin.…")` check and vice versa.
- **Unknown-claim rejection at boot** — registering a route with an
  undeclared claim throws during boot, before the server listens.

## Acceptance criteria

- [ ] Boot builds `fastify.claimCatalog` from all manifests; a manifest with
      a malformed claim fails boot with the plugin id in the message.
- [ ] `danglingClaims` flags claims of a disabled plugin without removing
      them from the catalog.
- [ ] A protected route accepts/denies purely from DB state: flipping a
      `role_claims` row flips the next request's result, no restart.
- [ ] `withWorkspace` never reads a client-sent workspace header; workspace
      resolution comes from the route's entity row.
- [ ] All six test groups in 4.6 pass; `pnpm build` green in shared-backend.
- [ ] 403 bodies are plain language and contain no raw claim strings.

## Out of scope

- Role seeding/CRUD and member APIs (task 5), grant management APIs and the
  share surface (task 6), app tables + implicit app-owner (task 7).
- Deny-grants (plan §5: allow-only in v1) and claim-level SSE filtering
  (membership-level only, plan §9).
