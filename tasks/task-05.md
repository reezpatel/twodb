# Task 5 — Workspace roles & members

Plan refs: plan.md §3 (claims, `roleDefaults`, claim catalog), §4 (workspace
roles), §8 (data model), §9 (bus facts), §11 (API sketch)
Depends on: task-04
Status: not started

## Goal

Roles become real. Every workspace gets its five default roles seeded from
the installed plugins' manifest `roleDefaults`; plugin install/disable/
upgrade reconciles those defaults automatically; managers can define custom
roles from the claim catalog and assign any role to any member. The guards
from plan §4 are enforced: a workspace always has ≥1 owner, a membership
always has ≥1 role, system roles are locked, and custom roles are user data
the system never mutates.

## Deliverables

### 5.1 Migrations (`plugins/identity/service/migrations/`)

Per plan §8, prefixed text PKs via `newId`:

```text
roles              id 'rol-'…, workspace_id → workspaces, key text,
                   name text, description text, is_system bool default false,
                   created_at, unique (workspace_id, key)
role_claims        role_id → roles, claim text,
                   primary key (role_id, claim)
role_assignments   id 'asg-'…, workspace_id → workspaces, user_id → users,
                   role_id → roles, created_at,
                   unique (workspace_id, user_id, role_id)
```

- `key` is the stable machine name (`owner`, `manager`, … or a slug for
  custom roles); `name`/`description` are display text.
- `role_claims.claim` is validated against the boot-built catalog (task-04
  `fastify.claimCatalog`) at write time — a role can never hold a claim no
  installed plugin declared. `app.*` claims are rejected here; they belong
  to app roles (task 7).

### 5.2 Default-role seeding on workspace creation

Extend the task-2 `POST /workspaces` handler (same transaction as the
workspace insert):

1. Create the five system roles: `owner`, `manager`, `editor`, `reader`,
   `guest` — all `is_system: true`.
2. Populate claims from the manifests of plugins installed in the workspace:
   - `owner` ← the **entire claim catalog** (implicit, never listed in
     manifests — hard rule 2).
   - `manager` / `editor` / `reader` ← the union of each installed plugin's
     `roleDefaults[key]`.
   - `guest` ← **empty, always** (plan §4 — everything a guest does comes
     from entity grants, task 6).
3. Assign the creator `owner` (a `role_assignments` row, not a flag) and
   emit `twodb.identity.role.assigned`.

The identity plugin's own `roleDefaults` (declared in task 2's manifest)
are what give `manager` the platform claims
(`plugin.twodb.identity:member.invite`, `:role.manage`,
`:workspace.manage`) — seeding is one code path, platform or plugin.

### 5.3 Reconciliation engine (`plugins/identity/service/reconcile.ts`)

One pure, unit-tested function driven by plugin lifecycle hooks:

```ts
async function reconcileWorkspaceRoles(
  workspaceId: string,
  plugin: InstalledPlugin,        // manifest + its roleDefaults
  direction: "install" | "disable" | "upgrade",
): Promise<void>
```

- **install** → merge the plugin's `roleDefaults` claims into the
  workspace's `manager`/`editor`/`reader` rows, and its full `permissions`
  into `owner`. Inserts only; dedupe via the PK.
- **disable** → remove exactly those claims from the system roles.
- **upgrade** with changed `roleDefaults` → diff old vs new manifest and
  apply both directions.
- **System roles only.** The engine touches rows where `is_system = true`
  and nothing else. Custom roles are user data (hard rule 7): when a
  disable leaves a custom role holding claims no plugin declares anymore,
  those claims are **left in place** and surfaced — role GET responses mark
  each claim with `dangling: true` when it is absent from the current
  catalog. Dangling claims are inert in evaluation (task-04 resolves
  against the catalog) but never silently deleted.
- Both directions emit bus facts so audit/automation can follow.

### 5.4 Role CRUD APIs (plan §11 routes)

| Route | Notes |
| --- | --- |
| `GET /workspaces/:id/roles` | all roles with claims (each flagged `dangling` where applicable) **plus the claim catalog** for the editor UI — one round-trip |
| `POST /workspaces/:id/roles` | create custom role; `preHandler: requireClaim("plugin.twodb.identity:role.manage")`; `is_system: false`, key slugified from name, claims validated against catalog |
| `PATCH /roles/:roleId` | rename/description/claims; 409 `role_locked` when `is_system` |
| `DELETE /roles/:roleId` | 409 when `is_system`; 409 `role_in_use` while assignments exist unless the request carries `reassignTo: <roleId>` — then assignments move in one transaction |
| `POST /workspaces/:id/roles/:key/clone` | copies a system role into a new custom role (the sanctioned way to "edit a default", plan §4) |

Custom role keys must not collide with the five system keys.

### 5.5 Assignment APIs & guards

| Route | Notes |
| --- | --- |
| `POST /workspaces/:id/assignments` | `{ userId, roleId }` — member must exist; emits `twodb.identity.role.assigned` |
| `DELETE /workspaces/:id/assignments/:assignmentId` | emits `twodb.identity.role.revoked` |

Guards (all 409 with plain-language errors):

- **≥1 owner**: demoting or unassigning the workspace's last `owner`
  holder is refused — "Transfer ownership to someone else first." Counted
  in the same transaction as the delete.
- **≥1 role per membership**: revoking a member's last role deletes their
  `workspace_members` row instead (plan §4) — and emits
  `twodb.identity.workspace.member.removed`.
- **System roles locked**: no claim edits via the API (5.4); reconciliation
  (5.3) is the only writer.

### 5.6 Members APIs

| Route | Notes |
| --- | --- |
| `GET /workspaces/:id/members` | members joined with their roles (id/key/name per assignment) |
| `POST /workspaces/:id/members` | invite by identifier (email/phone per `TWODB_IDENTIFIER`) + initial role; **creates the `users` row if absent** (unverified, no auth methods — they activate on first sign-in, task 3); creates membership + assignment; emits `twodb.identity.workspace.member.added` + `role.assigned` |
| `DELETE /workspaces/:id/members/:userId` | removes membership + all assignments; owner guard applies; emits `member.removed` + one `role.revoked` per assignment |

Invite requires `plugin.twodb.identity:member.invite`; role/assignment
routes require `:role.manage` (or ownership of the specific assignment for
self-demotion, still subject to the owner guard).

## Key decisions to honor

- Default roles are **system-managed from manifests** — people clone, the
  system reconciles; the two write paths never mix (hard rule 7).
- `owner` = full catalog, `guest` = nothing, both **by construction** —
  never read from any manifest.
- Dangling claims in custom roles are **surfaced, not deleted**, and never
  break evaluation (hard rule 7, plan §3).
- Every mutation emits its `twodb.identity.*` fact from the contracts event
  map (hard rule 8).

## Acceptance criteria

- [ ] Creating a workspace with a toy plugin installed (manifest with
      `roleDefaults` for manager/editor/reader) seeds owner = full catalog,
      the three roles per the manifest, guest = empty — verified by `GET
      /workspaces/:id/roles`.
- [ ] Installing the toy plugin into an existing workspace merges its claims
      into the default roles; disabling removes exactly those claims; an
      upgrade with changed `roleDefaults` diffs correctly.
- [ ] A custom role holding one of the toy plugin's claims keeps it after
      disable, and the role GET flags it `dangling: true` — while effective
      claims for an assignee no longer include it.
- [ ] Custom role lifecycle: create from catalog → assign → patch claims →
      delete with `reassignTo` moves members; delete while assigned without
      `reassignTo` → 409.
- [ ] Last-owner demotion/removal → 409; revoking a member's last role
      removes the membership; `PATCH` on a system role → 409 `role_locked`;
      clone produces an editable custom copy.
- [ ] Invite by email for a nonexistent address creates exactly one `usr-…`
      row and lands the membership + role.
- [ ] Every route above emits the expected `twodb.identity.*` bus facts.

## Out of scope

- Entity grants and the guest share flow (task 6) — `guest` here is just
  the empty role.
- App roles (`requireAppClaim`, app seeding) — task 7.
- The members & roles settings UI (task 9) — this task is engine + HTTP.
