# Task 8 — Superadmin & deployment settings

Plan refs: plan.md §7 (superadmin), §10 (two-level methods, verified gate),
§11 (admin API sketch), §12 (superadmin auth settings)
Depends on: task-03
Status: not started

## Goal

The superadmin layer: env-seeded first admin, promote/demote with a
last-superadmin guard, and the admin APIs that configure the deployment at
runtime — the sign-in method catalogue (incl. OIDC provider configs), the
verified-only gate, org listing/suspension, and a usage overview. Every admin
action is audited twice: a row in `audit_log` and a bus fact. Superadmins
configure the deployment; they never touch workspace content tables (hard
rule 9).

## Deliverables

### 8.1 Migrations (`plugins/identity/service/migrations/`)

```text
audit_log            id 'aud-'…, actor → users, action text, target text,
                     payload jsonb, created_at timestamptz default now()
deployment_settings  key text primary key, value jsonb, updated_at timestamptz
```

Plus `alter table organizations add column suspended_at timestamptz` (null =
active). `platform_admins` itself already landed in task 2.

### 8.2 Superadmin lifecycle

- **Boot seeding (idempotent)** — replaces task 2's one-shot insert: on every
  boot, if `TWODB_SUPERADMIN_EMAIL` matches an existing user, ensure a
  `platform_admins` row exists (insert-on-conflict-do-nothing). Demoting that
  user in the UI therefore gets undone on the next boot — env is the floor,
  and the docs say so.
- **`isSuperadmin` on the principal** — already computed by the task-2
  `resolvePrincipal` from `platform_admins`; confirm it rides
  `fastify.principal` on every request and the contracts DTO.
- **Promote/demote** — superadmins manage `platform_admins` rows. Demote
  refuses when the target is the **last** superadmin: 409 "Add another
  superadmin first." Same shape as the task-3 last-method guard.

### 8.3 The `isSuperadmin` preHandler

One shared guard in the identity service (exported for reuse):

```ts
// plugins/identity/service/admin.ts
export function requireSuperadmin(req, reply) {
  if (!req.principal?.isSuperadmin) {
    return reply.code(403).send({ error: "Only a superadmin can do that." });
  }
}
```

Every route under `/admin/…` gets it as `preHandler`. None of these routes
read or write org/workspace content tables — the guard is also the boundary
reviewers check.

### 8.4 Admin APIs (all under `/api/v1/twodb.identity/admin/…`)

| Route | Notes |
| --- | --- |
| `GET /admin/auth-methods` | the deployment catalogue from `deployment_auth_methods` (task 3), secrets masked |
| `PUT /admin/auth-methods` | enable/disable `password`, `email_link`, `phone_otp`; create/update `sso.oidc.<slug>` configs (`issuer`, `client_id`, `client_secret`, `scopes`) — runtime, no redeploy |
| `PUT /admin/access-policy` | verified-only gate toggle, stored in `deployment_settings` |
| `GET /admin/orgs` | orgs with member/workspace counts and `suspended_at` |
| `POST /admin/orgs/:id/suspend` | sets/clears `suspended_at` (`{ suspended: bool }`) |
| `GET /admin/overview` | usage/health counts: users, sessions active, orgs, workspaces, methods enabled |
| `GET /admin/superadmins` / `POST` / `DELETE /:userId` | promote/demote with the last-superadmin guard |

- **Secrets: encrypted at rest** (the picked option). `client_secret` and any
  SMTP/SMS credentials are encrypted with a deployment key from
  `TWODB_SECRET_KEY` (aes-256-gcm, random nonce per write) before landing in
  `deployment_auth_methods.config`; reads decrypt server-side only, API
  responses mask them (`"client_secret": "••••"`). Trade-off vs
  env-referenced secrets: env references survive nothing — a provider added
  at runtime would need a redeploy to add its secret, which kills the core
  acceptance criterion. Encryption-at-rest keeps runtime config possible at
  the cost of key custody (losing `TWODB_SECRET_KEY` means re-entering
  secrets). Documented in the admin surface copy.
- **Gate precedence** — `deployment_settings.require_verified` wins when the
  row exists; `TWODB_REQUIRE_VERIFIED` is only the seed for a fresh
  deployment. The task-3 `onRequest` second stage reads the resolved value
  per request (cached briefly), so flipping the toggle takes effect without
  a restart.
- **Org suspension** — enforcement lives in the task-4 `withWorkspace`
  preHandler: after resolving the workspace, reject with 403
  `{ error: "org_suspended" }` when its org has `suspended_at` set. If task 4
  hasn't landed, this task defines the hook point (a single
  `checkOrgSuspended(workspace)` call inside `withWorkspace`) and guards the
  identity plugin's own workspace routes with it directly.

### 8.5 Audit + bus facts

Every admin mutation goes through one helper:

```ts
await audit(fastify, {
  actor: req.principal.user.id,
  action: "auth-method.updated",          // or org.suspended, gate.toggled, …
  target: "sso.oidc.acme",
  payload: { enabled: true, scopes: ["openid", "email"] }, // secrets redacted
});
```

It appends the `audit_log` row **and** emits the matching bus fact
(`twodb.identity.authmethod.configured`, `twodb.identity.org.suspended`,
`twodb.identity.superadmin.promoted`, … — typed in contracts per hard rule
8). Payloads never contain plaintext secrets.

**Assume-role: deferred** (plan ▸ decision — no implicit content access,
support access would be an explicit, time-boxed, audited assume-role). This
task only marks the hook point: the audit helper and the `withWorkspace`
principal path are where a future `assumedBy` field would slot in. Do not
build it.

### 8.6 Superadmin settings surface (frontend, `plugins/identity/view/`)

A separate route group in the shell (`/twodb.identity/admin/…`), registered
by the identity view plugin and rendered only when
`principal.isSuperadmin` — everyone else never sees the nav entry. Sections:

- **Sign-in methods** — toggle cards for password / email link / phone OTP,
  plus "Add SSO provider" OIDC forms (issuer, client id, client secret,
  scopes) and SMTP/SMS sender config for the task-3 `fastify.mailer` /
  `fastify.texter` drivers.
- **Access gate** — the verified-only toggle, with copy that states the
  precedence ("This switch overrides the server setting").
- **Organizations** — list from `GET /admin/orgs` with suspend/unsuspend and
  a confirm dialog that says what suspension does.

Copy is plain-language per PRODUCT.md: "Who can sign in, and how", "Only let
in people with a verified email", "Suspending an organization signs everyone
out of its workspaces". Never the words "claim", "principal", or "OIDC"
without a plain gloss ("single sign-on (OIDC)").

## Key decisions to honor

- Superadmin administers the deployment, never tenant content — no
  `/admin/…` route joins into workspace tables (hard rule 9).
- Env seed is the floor: `TWODB_SUPERADMIN_EMAIL` re-asserts itself on every
  boot; runtime promote/demote manages everyone else.
- Secrets encrypted at rest, masked in every response, redacted in audit
  payloads.
- Runtime toggle beats env seed for the verified gate — env is a default,
  not an override.

## Acceptance criteria

- [ ] Env-seeded superadmin configures a new `sso.oidc.<slug>` provider via
      `PUT /admin/auth-methods` and signs in through it — no redeploy, no
      restart.
- [ ] Flipping the verified-only gate at runtime confines an unverified
      session to the verify endpoints (403 `verify_required` elsewhere),
      overriding the env seed — proves the task-3 integration.
- [ ] Suspending an org 403s its members on that org's workspace routes at
      the `withWorkspace` layer; unsuspending restores access.
- [ ] Demoting the last superadmin → 409 with the plain-language error.
- [ ] Every admin action (method config, gate toggle, suspend, promote)
      appears in `audit_log` with actor/action/target/payload and a matching
      bus fact; no plaintext secrets in either.
- [ ] A non-superadmin gets 403 on every `/admin/…` route; the settings
      surface doesn't render for them.

## Out of scope

- Audited, time-boxed assume-role into tenant content (deferred — hook
  points noted only).
- The login screen, verify holding screen, and user-facing security settings
  (task 9); this task is the superadmin surface only.
- Feature flags, storage/limits config beyond the method catalogue and the
  gate.
