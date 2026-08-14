# Task 1 — Contracts, id registry & provider-slot plumbing

Plan refs: plan.md §3 (claims), §8 (entity ids), §12 (provider slots)
Depends on: nothing — first task
Status: done (2026-08-14)

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

### 1.3 The identity contract — `packages/contracts/src/identity.ts`

Contracts carries only the **consumer-facing identity surface** — the shape
of the `useIdentity()` hook — plus the backend swap contract. Authn/IdP
mechanics (email vs phone, SSO, SAML, sessions) are implementation details
owned by the identity plugin package itself (task-02), never shared types.

```ts
export type IdentityStatus = "loading" | "signed_out" | "unverified" | "ready";

export interface IdentitySnapshot {          // what refetch() fetches
  user: { id: string; name: string } | null;
  workspaces: IdentityWorkspace[];
  activeWorkspaceId: string | null;
  roles: string[];
  claims: Claim[];
}

export interface Identity {                  // the useIdentity() shape
  status: IdentityStatus;
  userId: string | null;
  userName: string | null;
  accountId: string | null;                  // active org
  workspaceId: string | null;
  workspaces: IdentityWorkspace[];
  activeWorkspace: IdentityWorkspace | null;
  roles: string[];
  claims: Claim[];
  hasClaim(claim: Claim): boolean;
  switchWorkspace(workspaceId: string): void;
  refetch(): Promise<void>;
  signOut(): Promise<void>;
}

export interface Principal {                 // backend swap contract (onRequest hook)
  userId: string;
  isSuperadmin: boolean;
}
```

Endpoint request/response DTOs (plan §11) live in the identity plugin, not
in contracts — a replacement identity provider only has to honor the two
shapes above.

### 1.4 Event map entries

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

- [x] `pnpm build` green in contracts + shared-frontend + shared-backend.
- [x] `isClaim` accepts `plugin.twodb.notes:note.read` / `app.ledger:entry.create`,
      rejects `twodb.notes:read`, `plugin.:x`, uppercase ids.
- [x] `newId("usr")` matches `ID_RE`; v7 time-ordering holds for sequential ids.
- [x] A scratch view plugin can `registerProvider("footer", impl)` and the
      shell resolves it via `useProvider("footer")`; double registration throws.
- [x] `validateManifest` rejects a `roleDefaults` entry referencing an
      undeclared claim or the keys `owner`/`guest`.

Deviation from the spec as written: contracts stays **dependency-free** —
validators are hand-rolled functions instead of zod schemas (zod would be the
package's first runtime dependency, against its charter).

## Out of scope

- Any HTTP route, database table, or React screen.
- Real provider implementations (task 9 fills `identity`).
