# Task 1 — Contracts, id registry & provider-slot plumbing

Plan refs: plan.md §3 (claims), §8 (entity ids), §12 (provider slots)
Depends on: nothing — first task
Status: not started

## Goal

Every type, constant, and validator that later tasks import lives in
`@twodb/contracts` (pure types + zod, no runtime deps) and the provider-slot
registry lands in `@twodb/shared-frontend`. No database, no HTTP — this task
is the shared vocabulary.

## Deliverables

### 1.1 Claim primitives — `packages/contracts/src/claims.ts`

```ts
export const PLUGIN_CLAIM_RE =
  /^plugin\.[a-z][a-z0-9]*(\.[a-z0-9]+)*:[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;
export const APP_CLAIM_RE =
  /^app\.[a-z][a-z0-9]*(\.[a-z0-9]+)*:[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;

export type PluginClaim = `plugin.${string}:${string}`;
export type AppClaim = `app.${string}:${string}`;
export type Claim = PluginClaim | AppClaim;

export function isClaim(s: string): s is Claim;
```

### 1.2 Default-role names — `packages/contracts/src/roles.ts`

```ts
export const DEFAULT_ROLE_KEYS = ["owner", "manager", "editor", "reader", "guest"] as const;
export type DefaultRoleKey = (typeof DEFAULT_ROLE_KEYS)[number];
// keys a manifest's roleDefaults may address:
export type RoleDefaultKey = Exclude<DefaultRoleKey, "owner" | "guest">;
```

### 1.3 DTOs + zod schemas — `packages/contracts/src/identity.ts`

Mirror plan §8 exactly; ids are prefixed-id strings (1.5).

- `User { id, email?, phone?, name, emailVerifiedAt?, phoneVerifiedAt?, createdAt }`
- `Principal { user: User, isSuperadmin: boolean }`
- `Organization { id, name, slug, createdBy, createdAt }`
- `OrgMembership { orgId, userId, isAdmin }`
- `Workspace { id, orgId, name, slug, createdAt }`
- `Role { id, workspaceId, key, name, description, isSystem, claims: Claim[] }`
- `RoleAssignment { workspaceId, userId, roleId }`
- `EntityGrant { id, workspaceId, entityType, entityId, userId, claims: Claim[], grantedBy, createdAt }`
- `AppRole { id, appId, key, name, isSystem, claims: AppClaim[] }`
- `AuthMethodInfo { id, method, enabled, createdAt }` (user-level)
- `DeploymentAuthMethod { method, enabled, config }` (superadmin-level)
- Request/response DTOs for every endpoint listed in plan §11.

### 1.4 Event map entries — `packages/contracts/src/events.ts`

Append to `BackendEventMap` (facts, verb-past, payloads minimal):

```ts
"twodb.identity.user.created":            { userId: string };
"twodb.identity.session.started":         { userId: string; authMethod: string };
"twodb.identity.org.created":             { orgId: string; ownerId: string };
"twodb.identity.workspace.created":       { workspaceId: string; orgId: string };
"twodb.identity.workspace.member.added":  { workspaceId: string; userId: string };
"twodb.identity.workspace.member.removed":{ workspaceId: string; userId: string };
"twodb.identity.role.created":            { workspaceId: string; roleId: string };
"twodb.identity.role.assigned":           { workspaceId: string; userId: string; roleId: string };
"twodb.identity.role.revoked":            { workspaceId: string; userId: string; roleId: string };
"twodb.identity.entity.granted":          { workspaceId: string; entityType: string; entityId: string; userId: string };
"twodb.identity.entity.revoked":          { workspaceId: string; entityType: string; entityId: string; userId: string };
"twodb.identity.app.role.assigned":       { appId: string; userId: string; appRoleId: string };
"twodb.identity.app.role.revoked":        { appId: string; userId: string; appRoleId: string };
"twodb.identity.authmethod.configured":   { method: string };
```

### 1.5 Entity-id registry — `packages/contracts/src/ids.ts`

```ts
export const ID_RE = /^[a-z]{3}-[0-9A-Za-z]{22}$/;
export const ID_PREFIXES = {
  user: "usr", session: "ses", org: "org", orgMembership: "omb",
  workspace: "wks", workspaceMember: "wmb", role: "rol",
  assignment: "asg", grant: "grt", app: "app", appRole: "aro",
  authMethod: "amt", verificationCode: "vcd",
} as const;
export function isEntityId(s: string): boolean;
```

The runtime `newId(prefix)` helper itself lives in `@twodb/shared-backend`
(UUID v7 → base62, 22 chars) — add it here too, with a unit test (shape,
sortability, uniqueness over 100k generations).

### 1.6 Provider slots — contracts side, `packages/contracts/src/providers.ts`

```ts
export const PROVIDER_SLOTS = ["identity", "footer", "taskbar"] as const;
export type ProviderSlot = (typeof PROVIDER_SLOTS)[number];
export const REQUIRED_PROVIDER_SLOTS: ProviderSlot[] = ["identity"];
```

### 1.7 Provider slots — frontend side, `packages/shared-frontend/src/providers.ts`

The single control file for provider slots:

- `registerProvider(slot, impl)` — called by a view plugin's `activate()`.
- `getProvider(slot)` / `useProvider(slot)` — sync getter + React hook
  (re-render on swap).
- Boot validation: duplicate registration for a slot throws with both plugin
  names in the message; after all plugins activate, missing
  `REQUIRED_PROVIDER_SLOTS` throws.
- Manifest typing: view manifests gain `provider?: ProviderSlot` — the shell
  reads it to know which plugin *intends* to fill a slot (for a future
  plugin-manager UI), while `registerProvider` performs the actual wiring.

### 1.8 Manifest schema update

`manifest.ts` type gains:

```ts
permissions: Claim[];
roleDefaults?: Partial<Record<RoleDefaultKey, Claim[]>>;
provider?: ProviderSlot; // view manifests only
```

Validation helpers (`validateManifest`): every `permissions` entry matches a
claim regex; every `roleDefaults` value is a subset of `permissions`;
`roleDefaults` never lists `owner`/`guest`.

## Acceptance criteria

- [ ] `pnpm build` green in contracts + shared-frontend + shared-backend.
- [ ] `isClaim` accepts `plugin.twodb.notes:note.read` / `app.ledger:entry.create`,
      rejects `twodb.notes:read`, `plugin.:x`, uppercase ids.
- [ ] `newId("usr")` matches `ID_RE`; v7 time-ordering holds for sequential ids.
- [ ] A scratch view plugin can `registerProvider("footer", impl)` and the
      shell resolves it via `useProvider("footer")`; double registration throws.
- [ ] `validateManifest` rejects a `roleDefaults` entry referencing an
      undeclared claim or the keys `owner`/`guest`.

## Out of scope

- Any HTTP route, database table, or React screen.
- Real provider implementations (task 9 fills `identity`).
