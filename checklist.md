# twodb Identity & Access Control — Build Checklist

Status: **not started**. This is the executable breakdown of `plan.md`
(identity, tenancy & access control). `plan.md` says *what and why*; this file
says *what to do, in what order*; `tasks/task-NN.md` files say *how, in full
detail*.

Work top to bottom — each step assumes the ones above it are done.

## Cross-cutting conventions (apply to every task)

- **Claims** — `plugin.<plugin_id>:<noun>[.<verb>]` / `app.<app_slug>:<noun>[.<verb>]`,
  declared only in manifests, validated at boot (plan §3).
- **Ids** — `XXX-<base62 uuid v7>`, prefixes registered in `@twodb/contracts`
  (plan §8 "Entity ids").
- **Events** — every access change is a bus fact typed in `@twodb/contracts`,
  named `<plugin_id>.<noun>.<verb-past>` (plan §9).
- **Provider slots** — replaceable shell surfaces declared via the view
  manifest's `provider` key; slot names in `packages/contracts/src/providers.ts`,
  registration/lookup in `@twodb/shared-frontend` (plan §12).
- **Auth on requests** — a fastify `onRequest` hook owned by the identity
  service plugin resolves the session into `fastify.principal`; claim checks
  are `preHandler` factories from `@twodb/shared-backend` (plan §9).
- **Backend is the only authority** — frontend claim checks are cosmetic.

## Steps

### 1. Contracts, id registry & provider-slot plumbing → [task-01](tasks/task-01.md) ✅ done (2026-08-14)

Foundation types everything else imports.

- Claim/role/grant/assignment DTOs + zod schemas in `@twodb/contracts`.
- `twodb.identity.*` event map entries (user/org/workspace/role/grant facts).
- Claim-shape validators + the id-prefix registry (`usr`, `org`, `wks`, …).
- `providers.ts` in contracts (slot names) + register/lookup/`useProvider()`
  in `@twodb/shared-frontend`; manifest schema gains the optional
  `provider` key; boot validation (one provider per slot).
- **Done when:** contracts compiles with the new DTOs; a toy plugin can
  register and resolve a provider slot in the shell.

### 2. Identity service plugin — core tenancy + password login → [task-02](tasks/task-02.md) ✅ done (2026-08-14)

First real plugin under the new model; everything later hangs off it.

- Migrations: `users`, `sessions`, `platform_admins`, `organizations`,
  `org_memberships`, `workspaces`, `workspace_members` (schema per plan §8).
- `twodb.identity` service plugin: login/logout/session endpoints, org +
  workspace + membership CRUD, `me/memberships`.
- The fastify `onRequest` hook: session cookie → `fastify.principal`
  (`{ user, isSuperadmin }`), 401 for protected routes without a session.
- Identifier mode read from env (`TWODB_IDENTIFIER`); one-row-per-identifier
  enforced by unique constraints.
- **Done when:** a user can register/login, create an org + workspace, and
  every request carries a resolved principal.

### 3. Sign-in methods & verification → [task-03](tasks/task-03.md)

The two-level method model and the verified gate (plan §10).

- Migrations: `user_auth_methods`, `deployment_auth_methods`,
  `verification_codes`; `verified_at` columns already on `users`.
- Method engine: a method works only when enabled at **both** levels;
  never disable your last enabled method; availability follows the
  identifier mode.
- `password`, `email_link`, `phone_otp` methods + generic OIDC (`sso.*`)
  with link-to-existing-row semantics.
- Verification flow (codes, `verified_at`) + `TWODB_REQUIRE_VERIFIED`
  holding state for unverified sessions.
- User APIs: `me/auth-methods` list/add/toggle; `auth/methods` catalog.
- **Done when:** a user can turn off password after linking SSO, and the
  verified-only gate confines unverified sessions.

### 4. Authz engine in shared-backend → [task-04](tasks/task-04.md)

Claims become enforceable (plan §3, §9).

- Claim catalog built at boot from all manifests; `fastify.claimCatalog`.
- `withWorkspace` preHandler: resolve workspace from the route's entity,
  load roles + assignments + grants once, cache effective claims per request.
- `requireClaim(claim, { entity, idParam })` and `requireAppClaim(claim)`
  preHandler factories; 403s in plain language.
- Effective-claims SQL: role claims ∪ entity grants; unit-tested resolution
  (guest = zero, cross-workspace denied, app/plugin isolation).
- **Done when:** a protected route accepts/denies purely from the DB state.

### 5. Workspace roles & members → [task-05](tasks/task-05.md)

Roles become real (plan §4).

- Default-role seeding on workspace creation from manifests' `roleDefaults`
  (owner = full catalog, guest = empty).
- Reconciliation on plugin install/disable/upgrade — default roles only;
  custom roles never system-mutated (dangling claims surfaced).
- Role CRUD + assignments APIs; guards: ≥1 owner, ≥1 role per membership,
  system roles locked (clone to customize).
- Members APIs: list / invite / remove, with role assignment.
- **Done when:** a manager can create a custom role from the claim catalog
  and assign it; defaults track plugin installs.

### 6. Entity grants & guest access → [task-06](tasks/task-06.md)

Per-entity overrides (plan §5).

- `entity_grants` migration + create/revoke/list APIs; granter must hold the
  claims they grant.
- Share dialog shell slot; guest invite flow (guest membership + grant on
  one entity).
- Dogfood: apply `requireClaim` with entity options to the `twodb.notes`
  routes — the first real consumer.
- **Done when:** a reader can be made editor of one note, and a guest sees
  exactly one shared note and nothing else.

### 7. Custom app auth → [task-07](tasks/task-07.md)

App-level roles and claims (plan §6).

- `apps`, `app_roles`, `app_role_claims`, `app_role_assignments` migrations.
- App manifests declare app claims + `roleDefaults`; app roles seeded per
  app instance; workspace owner/manager implicitly app-owner.
- App assignment APIs + app access panel; `requireAppClaim` wired and tested.
- **Done when:** an app can be shared with a workspace guest via a grant,
  and `app.*` claims never authorize workspace content.

### 8. Superadmin & deployment settings → [task-08](tasks/task-08.md)

Deployment control without content access (plan §7, §10).

- `platform_admins` seeding from `TWODB_SUPERADMIN_EMAIL`; `isSuperadmin`
  on the principal.
- Admin APIs: auth-method catalogue config, verified-only gate toggle, org
  list/suspend; every admin action is an audit fact.
- Superadmin settings surface (method configs, gate, orgs).
- **Done when:** a superadmin can configure an OIDC provider at runtime and
  flip the verified-only gate — without touching tenant content tables.

### 9. Frontend identity provider → [task-09](tasks/task-09.md)

The identity view plugin claims the `identity` provider slot (plan §12).

- Login screen driven by `auth/methods` (password / link / OTP / SSO
  buttons), verify holding screen, route guards.
- Workspace picker (org → workspace) feeding the shell's active workspace.
- Members & roles settings (role editor = claim checklist from the catalog),
  sign-in & security settings (method toggles, link SSO, resend verification).
- `useIdentity()` for cosmetic gating; SSE-driven refresh on access-change
  facts.
- **Done when:** the whole model is drivable from the UI, and swapping the
  identity provider plugin requires no shell changes.

## Notes

- Tasks 3 and 8 overlap slightly (method config UI lives in 8; method engine
  in 3) — build engine first, surface second.
- Task 9 can start once task 2 lands (login screen against real sessions);
  its later sections track 5–7.
- Keep AGENTS.md honest: update its docs map when these files land.
