# Task 7 — Custom app auth

Plan refs: plan.md §3 (claim namespaces), §6 (custom app auth), §8 (data
model), §9 (enforcement), §11 (API sketch)
Depends on: task-06
Status: not started

## Goal

Custom apps get the full access model, one level down from workspaces: app
claims in the `app.<slug>:*` namespace, app roles seeded from the app
manifest's `roleDefaults`, per-(app, user) assignments independent of
workspace roles, and `requireAppClaim` enforced on app routes. The two claim
namespaces stay hermetic — `app.*` never authorizes workspace content,
`plugin.*` never authorizes app actions — and a workspace guest plus one app
grant composes into "an outside person who opens exactly one app."

## Deliverables

### 7.1 Migrations (`plugins/identity/service/migrations/`)

```text
apps                  id 'app-'…, workspace_id → workspaces, slug text,
                      name text, manifest jsonb, created_at timestamptz
                      default now(), unique (workspace_id, slug)
app_roles             id 'aro-'…, app_id → apps, key text, name text,
                      is_system bool, unique (app_id, key)
app_role_claims       app_role_id → app_roles, claim text,
                      primary key (app_role_id, claim)
app_role_assignments  app_id → apps, user_id → users,
                      app_role_id → app_roles, created_at,
                      primary key (app_id, user_id, app_role_id)
```

- Register the `aro` prefix in the contracts id registry (task-01).
- `apps.manifest` stores the generated app manifest verbatim — it is the
  source of truth for the app's claims and `roleDefaults`.

### 7.2 App manifest shape & catalog registration

App manifests declare claims and role defaults **exactly like plugin
manifests** (plan §3), under the app's namespace:

```ts
// sample app manifest (stored in apps.manifest at app creation)
{
  id: "app.ledger",
  permissions: [
    "app.ledger:entry.read",
    "app.ledger:entry.create",
    "app.ledger:entry.edit",
    "app.ledger:report.view",
  ],
  roleDefaults: {
    manager: [
      "app.ledger:entry.read",
      "app.ledger:entry.create",
      "app.ledger:entry.edit",
      "app.ledger:report.view",
    ],
    editor: [
      "app.ledger:entry.read",
      "app.ledger:entry.create",
      "app.ledger:entry.edit",
    ],
    reader: ["app.ledger:entry.read", "app.ledger:report.view"],
  },
}
```

- Same rules as plugins: values must come from the app's own `permissions`;
  `owner` is implicit-all and never listed; `guest` is always-none and never
  listed. Boot/creation-time validation rejects unknown roles or claims.
- When an app row is created, its claims register into the claim catalog
  (task-04 `fastify.claimCatalog`) under the `app.<slug>` namespace, so role
  APIs and the access panel validate against one catalog. Deleting an app
  unregisters its namespace.

### 7.3 App role seeding & custom app roles

- On app creation, seed the five default app roles from the manifest's
  `roleDefaults`: `owner` (full app claim set), `manager` / `editor` /
  `reader` (from the manifest), `guest` (zero claims). All seeded rows get
  `is_system: true` and are locked like workspace defaults (task-05) — clone
  to customize.
- **Custom app roles**: anyone who would hold app-owner on the app (see 7.4)
  can create an app role with a name and any subset of **the app's own claim
  set** — never workspace/plugin claims. Custom app roles are first-class:
  assignable, editable, deletable only when unassigned or reassigned.
- App roles never cross apps; a role row belongs to exactly one `app_id`.

### 7.4 Access rules

- App role assignments are per `(app_id, user_id)` and **independent of
  workspace roles** — being a workspace editor says nothing about any app.
- **Implicit app-owner**: workspace owners and managers implicitly hold
  app-owner on every app in their workspace (they can always manage app
  access). Compute this in the effective-claims resolution (task-04) from
  the workspace role set — never materialize rows for it.
- Everyone else needs an app role assignment **or an entity grant on the
  app** (`entity_grants` with `entity_type = 'app'`, from task-06) to use
  it. Effective app claims = app role claims ∪ grants on the app.
- A user does **not** need any workspace role beyond membership to hold an
  app role — that is what makes the guest composition work (7.7).

### 7.5 `requireAppClaim` wiring + isolation tests

The preHandler factory was built in task 4; here it is applied for real and
integration-tested:

```ts
fastify.post("/entries", {
  preHandler: [requireAppClaim("app.ledger:entry.create")],
}, createEntry);   // app resolved from the route's :appId / app slug param
```

- `requireAppClaim` resolves the app **from the route** (route param, never
  a client-sent header), loads the caller's app role claims ∪ app grants,
  adds implicit app-owner for workspace owner/managers, and 403s in plain
  language otherwise.
- **Namespace isolation, proven both directions** (hard rule 3):
  - A principal holding `app.ledger:*` (via app role or grant) gets 403 on a
    workspace content route requiring `plugin.twodb.notes:note.read`.
  - A principal holding `plugin.*` claims only (no app role, no grant, not a
    workspace manager) gets 403 on an app route requiring
    `app.ledger:entry.read`.
  - The role engine evaluates both namespaces with the same code; scope
    comes only from where the claim was granted.

### 7.6 App role/assignment APIs

Under `/api/v1/twodb.identity/apps/…` (plan §11), all gated by implicit or
assigned app-owner on the target app:

| Route | Notes |
| --- | --- |
| `GET /apps/:appId/roles` | app roles + claims, plus the app's claim set for the editor checklist |
| `POST /apps/:appId/roles` | custom app role from the app's claim set |
| `PATCH /apps/:appId/roles/:roleId` | rename / re-pick claims; system roles locked |
| `POST /apps/:appId/assignments` | `{ userId, appRoleId }`; emits `twodb.identity.app.role.assigned` |
| `DELETE /apps/:appId/assignments/:userId/:roleId` | emits `twodb.identity.app.role.revoked` |

This is the backend for the **app access panel** (the app-settings surface
from plan §12; the panel UI itself is frontend work, out of scope here).
Add both new events to the `@twodb/contracts` event map with payload
`{ appId, userId, appRoleId }`.

### 7.7 Guest composition — the explicit end-to-end scenario

Prove the plan §6 promise as a scripted integration test:

1. Create workspace + app (ledger sample manifest from 7.2).
2. Invite an outside user as a workspace **guest** (zero claims, task-05).
3. Grant that user an app role (or an entity grant on the app) with
   `app.ledger:entry.read`.
4. Assert: the guest can open the app and hit its read route (200); the same
   session gets 403 on the app's write route and on **every** workspace
   content route; `/me/memberships` shows the workspace but `useIdentity()`-
   equivalent effective claims for the workspace are empty.

## Key decisions to honor

- App manifests reuse the plugin manifest contract verbatim — same
  `permissions` + `roleDefaults` fields, same validation, same owner/guest
  rules. No app-specific claim machinery.
- Implicit app-owner for workspace owner/managers is computed, never stored.
- Grants on an app are ordinary `entity_grants` rows (`entity_type = 'app'`)
  — task-06 machinery, no special table.
- The catalog is rebuilt/extended when apps are created or deleted; role
  APIs never validate against the raw manifest JSON.

## Acceptance criteria

- [ ] Creating an app with the sample ledger manifest seeds five system app
      roles with claims matching `roleDefaults` (owner = all four claims,
      guest = zero), and the four `app.ledger:*` claims appear in the claim
      catalog.
- [ ] A workspace manager with **no** app assignment can list app roles and
      create assignments (implicit app-owner); a workspace editor cannot.
- [ ] Isolation direction 1: a user holding `app.ledger:entry.read` gets 403
      on a notes route requiring `plugin.twodb.notes:note.read`.
- [ ] Isolation direction 2: a workspace editor holding
      `plugin.twodb.notes:*` (but no app role/grant) gets 403 on the app's
      `entry.read` route.
- [ ] `POST /apps/:appId/assignments` emits
      `twodb.identity.app.role.assigned`; revoke emits
      `twodb.identity.app.role.revoked` — both typed in contracts.
- [ ] Guest scenario (7.7) passes end to end: one app readable, everything
      else in the workspace 403/empty.
- [ ] Custom app role created from the app's claim set works; a role
      referencing a `plugin.*` claim is rejected.

## Out of scope

- The AI app builder that generates app manifests (creates `apps` rows with
  its own output) and the app runtime itself.
- The app access panel **UI**, Share-dialog integration for apps, and all
  other frontend (task 9).
- App upgrade/reconciliation of `roleDefaults` over existing app roles —
  v1 seeds at creation only.
