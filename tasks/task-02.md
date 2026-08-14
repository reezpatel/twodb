# Task 2 — Identity service plugin: core tenancy + password login

Plan refs: plan.md §2 (hierarchy), §8 (data model), §9 (principal hook),
§10 (identifiers, sessions), §11 (API sketch)
Depends on: task-01
Status: done (2026-08-14)

## Goal

The `twodb.identity` service plugin exists and owns identity end-to-end:
users keyed by the deployment's identifier mode, password sessions, the
fastify `onRequest` hook that resolves `fastify.principal` on every request,
and the org → workspace → membership spine. No roles yet (task 5) — this is
the skeleton everything else bolts onto.

## Deliverables

### 2.1 Migrations (`plugins/identity/service/migrations/`)

Data layer: **Postgres + Kysely** (query builder and migration runner —
decided 2026-08-14). The identity plugin ships Kysely migrations for its own
tables; shared-backend provides the runner.

Per plan §8, with prefixed text PKs (task-01 `newId`) and the login key in a
single mode-independent `identifier` column:

```text
users              id 'usr-'…, identifier text unique, email citext,
                   phone text, name text,
                   email_verified_at timestamptz, phone_verified_at timestamptz,
                   created_at timestamptz default now()
sessions           id 'ses-'…, user_id → users, token_hash text unique,
                   auth_method text, expires_at timestamptz, created_at
platform_admins    user_id → users, granted_by → users, created_at
organizations      id 'org-'…, name, slug unique, created_by → users, created_at
org_memberships    org_id → organizations, user_id → users, is_admin bool,
                   created_at, primary key (org_id, user_id)
workspaces         id 'wks-'…, org_id → organizations, name, slug, created_at,
                   unique (org_id, slug)
workspace_members  workspace_id → workspaces, user_id → users, created_at,
                   primary key (workspace_id, user_id)
```

Uniqueness via one `identifier` column (`TWODB_IDENTIFIER = email | phone |
email+phone`, read at boot, fail-fast on invalid value). The schema never bakes
in the mode, so a deployment can switch modes without a migration:

- `users.identifier text not null unique` — always created, always unique.
- Runtime populates it: `email` / `email+phone` modes → the email;
  `phone` mode → the phone.
- Login matches `identifier` (plus the `phone` column in `email+phone` mode,
  so either address signs in).
- `email+phone` also enforces phone uniqueness at runtime (one extra select
  at register), so phone sign-in can never be ambiguous.

### 2.2 The service plugin skeleton

```ts
// plugins/identity/service/index.ts
export default fp(defineService({
  id: "twodb.identity",
  dependencies: [],
  async register(fastify) {
    // 2.3 hook, 2.4 routes
  },
}));
```

Manifest (`plugins/identity/manifest.ts`): declares the **platform claims**
(`plugin.twodb.identity:workspace.manage`, `:member.invite`, `:role.manage`,
`:org.manage`, `:workspace.create`, …) and their `roleDefaults` (manager gets
member/role/workspace manage; editor/reader none). These matter from task 4
on — declaring them now keeps the catalog whole.

### 2.3 The auth hook — the swap contract

Registered with `fastify-plugin` so it applies to the root instance (every
service plugin inherits it):

```ts
fastify.addHook("onRequest", async (req, reply) => {
  const token = req.cookies[SESSION_COOKIE];
  req.principal = await resolvePrincipal(token); // null when anonymous
  if (!req.principal && req.routeOptions.config?.public !== true) {
    return reply.code(401).send({ error: "Sign in to continue." });
  }
});
```

- `resolvePrincipal` looks up `sessions.token_hash` (sha-256 of the opaque
  token), checks expiry, loads the user, computes `isSuperadmin` from
  `platform_admins`. Result cached per request only — no session cache layer
  in v1 (measure first).
- Public routes (`auth/login`, `auth/verify`, health) opt out via
  `config: { public: true }`.
- Decorate `fastify.principal` + TypeScript augmentation in shared-backend so
  `req.principal` is typed everywhere. **This hook is the replacement
  contract**: an alternative identity plugin must set the same shape.

### 2.4 Routes (all under `/api/v1/twodb.identity/…`)

| Route | Notes |
| --- | --- |
| `POST /auth/register` | identifier per mode + password (argon2id); creates the single user row; 409 on duplicate identifier |
| `POST /auth/login` | identifier + password → opaque 32-byte token, httpOnly cookie, `sessions` row with `auth_method: "password"` |
| `POST /auth/logout` | deletes the session row, clears cookie |
| `GET /auth/session` | current `Principal` (drives the frontend boot) |
| `GET /me/memberships` | orgs + workspaces for the picker, one query each, assembled |
| `POST /orgs` | creates org + caller as admin member |
| `POST /workspaces` | in an org the caller admins; adds caller as member |
| `GET /workspaces/:id/members` | membership-gated (caller must be a member) |

Wire DTOs are owned by this plugin package — contracts carries only the
`IdentitySnapshot` / `Principal` shapes (task-01). Every mutation emits its
bus fact from the task-01 event map. First superadmin: on boot, if `TWODB_SUPERADMIN_EMAIL`
matches an existing user and `platform_admins` is empty, insert the row.

### 2.5 Shared-backend additions

- `newId(prefix)` (already from task 1) + `fastify.db` usage patterns.
- `fastify.principal` decoration typing.
- Cookie plugin registration (`@fastify/cookie`) in the api host boot, with
  `SESSION_COOKIE` name constant in contracts.

## Key decisions to honor

- One `users` row per identifier value — register/link paths upsert nothing;
  duplicates are 409s (hard rule 10).
- The hook sets the principal for **every** request, including anonymous ones
  (null) — downstream code never re-parses cookies.
- Switching workspace is **not** re-login; `/me/memberships` exists precisely
  so the shell picker can switch client-side.

## Acceptance criteria

- [x] Boot fails loudly on an invalid `TWODB_IDENTIFIER`.
- [x] Register + login + `GET /auth/session` round-trip via curl with the
      cookie jar; logout kills the session (401 after).
- [x] Duplicate email registration → 409 in `email` mode.
- [x] Org → workspace → member list flow works; non-member gets 401/403 on
      the members route.
- [x] A request log line shows the resolved `usr-…` id; anonymous requests
      show `principal: null`.
- [x] `TWODB_SUPERADMIN_EMAIL` bootstrap inserts exactly one admin row.

Deviations from the spec as written:

- Password hashing is **scrypt** (node:crypto, zero native deps) with a
  format-marked credential string, so argon2id can replace it later without
  a schema change. Plan said argon2id.
- The 401 enforcement covers `/api/v1/*` only — `/health` and the static app
  stay public. Notes routes (and SSE) now require a session; the mock shell
  has no login UI until task-09, so the old demo needs a cookie from curl.
- `password_hash` lives on `users` for now; task-03 moves it into
  `user_auth_methods` as specified there.
- The shared-backend auth stub (`request.user`) is kept for the notes
  service; `request.principal` lands alongside it.
- **Amended after review:** uniqueness moved off mode-conditional indexes on
  `email`/`phone` to a single `users.identifier` column (always unique,
  populated at runtime). The mode can now change without a schema migration;
  the dev DB was reset so migration 001 re-applied in the new shape.

## Out of scope

- Roles/claims enforcement (tasks 4–5), sign-in methods beyond password
  (task 3), anything frontend (task 9).
