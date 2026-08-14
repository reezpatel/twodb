# Task 2 — Identity service plugin: core tenancy + password login

Plan refs: plan.md §2 (hierarchy), §8 (data model), §9 (principal hook),
§10 (identifiers, sessions), §11 (API sketch)
Depends on: task-01
Status: not started

## Goal

The `twodb.identity` service plugin exists and owns identity end-to-end:
users keyed by the deployment's identifier mode, password sessions, the
fastify `onRequest` hook that resolves `fastify.principal` on every request,
and the org → workspace → membership spine. No roles yet (task 5) — this is
the skeleton everything else bolts onto.

## Deliverables

### 2.1 Migrations (`plugins/identity/service/migrations/`)

Per plan §8, with prefixed text PKs (task-01 `newId`) and the identifier
mode enforced at the DB layer:

```text
users              id 'usr-'…, email citext, phone text, name text,
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

Uniqueness by identifier mode (`TWODB_IDENTIFIER = email | phone | email+phone`,
read at boot, fail-fast on invalid value):

- `email` mode → `unique(email)`, phone nullable/non-unique.
- `phone` mode → `unique(phone)`, vice versa.
- `email+phone` → both unique, both required.

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

DTOs from contracts (task-01); every mutation emits its bus fact from the
task-01 event map. First superadmin: on boot, if `TWODB_SUPERADMIN_EMAIL`
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

- [ ] Boot fails loudly on an invalid `TWODB_IDENTIFIER`.
- [ ] Register + login + `GET /auth/session` round-trip via curl with the
      cookie jar; logout kills the session (401 after).
- [ ] Duplicate email registration → 409 in `email` mode.
- [ ] Org → workspace → member list flow works; non-member gets 401/403 on
      the members route.
- [ ] A request log line shows the resolved `usr-…` id; anonymous requests
      show `principal: null`.
- [ ] `TWODB_SUPERADMIN_EMAIL` bootstrap inserts exactly one admin row.

## Out of scope

- Roles/claims enforcement (tasks 4–5), sign-in methods beyond password
  (task 3), anything frontend (task 9).
