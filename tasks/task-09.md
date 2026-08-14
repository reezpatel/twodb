# Task 9 — Frontend identity provider

Plan refs: plan.md §9 (frontend paragraph), §10 (methods, verification),
§12 (frontend surfaces, provider slots)
Depends on: task-02 (login against real sessions); sections 9.5–9.6 track
tasks 5–7 (roles, grants, apps) as they land
Status: not started

## Goal

The `twodb.identity` view plugin (`plugins/identity/view/`) claims the
`identity` provider slot and delivers the whole identity experience: login,
verify holding screen, route guards, workspace picker, `useIdentity()`,
members & roles and sign-in & security settings, and the share dialog UI.
It is the **reference implementation of the provider-slot pattern** — a
replacement plugin must be able to fill the same slot without any shell
changes.

## Deliverables

### 9.1 View plugin skeleton + the identity slot contract

```ts
// plugins/identity/view/manifest.ts
export const manifest = {
  id: "twodb.identity",
  version: "1.0.0",
  provider: "identity", // fills the required slot from contracts/providers.ts
} satisfies PluginManifest;

// plugins/identity/view/index.ts
class IdentityView extends ViewPlugin {
  readonly manifest = manifest;
  activate() {
    registerProvider("identity", identityProviderImpl);
    this.contribute({ routes: [/* login, verify */], /* settings sections */ });
  }
}
```

`identityProviderImpl` is the **slot interface** — documented in
`@twodb/shared-frontend` as `IdentityProvider` and treated as the swap
contract. The data shape it feeds (`IdentitySnapshot`) and the hook shape
consumers use (`Identity`) come from contracts (task-01); the provider only
supplies screens + snapshot plumbing. A replacement plugin must implement
exactly:

```ts
interface IdentityProvider {
  LoginScreen: ComponentType;        // full-screen, rendered when signed out
  VerifyScreen: ComponentType;       // holding screen for verify_required
  WorkspacePicker: ComponentType;    // rendered in the shell sidebar
  ShareDialog: ComponentType<ShareDialogProps>; // entity grants UI
  fetchSnapshot(): Promise<IdentitySnapshot>;   // user, workspaces, roles, claims
  switchWorkspace(workspaceId: string): Promise<void>;
  signOut(): Promise<void>;
}
```

`useIdentity()` itself lives in shared-frontend: it resolves the `identity`
provider, keeps the snapshot fresh (SSE facts trigger refetch), and exposes
the contracts `Identity` shape — `status`, `userId`, `accountId`,
`workspaceId`, `workspaces`, `activeWorkspace`, `roles`, `claims`,
`hasClaim`, `switchWorkspace`, `refetch`, `signOut`.

The shell imports the interface from shared-frontend and resolves
implementations only via `useProvider("identity")` — it never imports
`plugins/identity/view` directly. That boundary is the acceptance test for
swappability: swapping plugins must be an install/uninstall, not a shell
patch.

### 9.2 Login, verify screen & route guards

- **Login screen** — driven by `GET /auth/methods` (task 3): render a
  password form, magic-link form, phone-OTP flow, or SSO buttons according
  to what the deployment offers. The identifier field switches between
  email and phone per `TWODB_IDENTIFIER` (exposed on `/auth/methods`); in
  `email+phone` mode offer both. Errors surfaced in plain language
  ("That code didn't work — ask for a new one."), never raw API messages.
- **Verify holding screen** — when any fetch returns 403
  `{ error: "verify_required" }`, the shell renders the provider's
  `VerifyScreen`: identifier, resend button, code input. It can reach only
  `auth/verify*` and `auth/logout` (hard rule 12) — no other UI is
  mounted.
- **Route guards** — on boot the shell calls `GET /auth/session`:
  no principal → `LoginScreen` (every protected route redirects there);
  principal + unverified gate on → `VerifyScreen`; otherwise the app.
  Guards live in the shell against `usePrincipal()` so a replacement
  provider only has to honor the same null/non-null contract.

### 9.3 Workspace picker

`WorkspacePicker` renders in the shell sidebar (org → workspace tree) fed
by `GET /me/memberships`. Selecting a workspace sets the **active
workspace in shell state** (extend `state.tsx` with
`activeWorkspaceId` + a setter function); switching is never a re-login
(plan §10). The picker shows display names only — ids never appear in the
UI.

### 9.4 `useIdentity()` — cosmetic gating

```ts
const { userId, workspaceId, claims, hasClaim } = useIdentity();
// claims: effective Claim[] for the active workspace
//         (role claims ∪ entity grants, computed server-side)
```

- Delivered over the existing SSE bridge: the backend pushes effective
  claims per workspace; the hook refreshes whenever a `twodb.identity.*`
  access-change fact (`role.assigned`, `role.revoked`, `entity.granted`,
  `entity.revoked`, `member.removed`) arrives for the active workspace.
- **Cosmetic only** (hard rule 1): use it to hide/disable buttons and menu
  items — never as an authorization decision. Every denial still comes
  from a 403.
- When the active workspace changes (9.3), the hook re-resolves.

### 9.5 Settings sections (contributed via the shell's settings slot)

Both sections register through the shell contribution mechanism from
`view-plugin.ts`, scoped to the active workspace.

**Members & roles** (requires `plugin.twodb.identity:*` claims, hidden
otherwise):

- Member list with per-member role assignment dropdowns; guards honored:
  ≥1 owner, ≥1 role per membership (backend 409s surfaced as plain-language
  toasts).
- Role editor: a name field + a checklist of permissions **grouped by
  plugin**, built from the claim catalog (`GET …/roles` returns roles plus
  the catalog). Each checklist row shows plain-language text ("can edit
  notes"), never the raw claim string.
- System roles render locked with a **"Make a copy"** button — the
  clone-a-default flow creates a custom role pre-filled with the default's
  checklist.
- **Dangling-claim badges**: custom roles holding claims from a disabled
  plugin show a badge ("from a turned-off feature") without editing the
  role (hard rule 7 — custom roles are never system-mutated).

**Sign-in & security** (any signed-in user):

- My methods from `GET /me/auth-methods` with per-method on/off switches
  (`PATCH /me/auth-methods/:id`). Attempting to switch off the last
  enabled method shows the 409 message: "Add another sign-in method
  first."
- "Link a sign-in provider" button per offered SSO method (begins the
  task-3 SSO link flow).
- Verification status per identifier with a **Resend** button
  (`POST /auth/verify`).

### 9.6 Share dialog UI

`ShareDialog` fills the slot contract from task 6 and is the **only place
guests appear** (plan §12): any plugin's entity toolbar renders the
provider's `ShareDialog` with `{ entityType, entityId }`.

- People list: who can do what on this entity, from
  `GET /grants?entityType=…&entityId=…`.
- Grant create: pick a person (or type an email/phone → guest invite
  flow), pick "can edit" / "can only look" (mapped to claim sets
  internally) → `POST /grants`.
- Revoke: per-row remove → `DELETE /grants/:id`, with a confirm step.
- The dialog never offers claims the granter doesn't hold (hard rule 4) —
  the checklist comes from `useIdentity()` intersected with the entity's
  claim family.

### 9.7 Styling & copy

- Per AGENTS.md: styled-jsx in sibling `<Component>.style.jsx` files,
  scoped `css` by default (`css.global` only for shell-hook classes),
  design tokens only (`var(--ink)`, `var(--space-3)`, …), components from
  `@twodb/ui` — never the design-system stylesheet path.
- Plain language everywhere (PRODUCT.md principle 1): "can edit", "can
  only look", "Sign in", "People in this workspace". The words **claim**,
  **principal**, **grant**, and **role key** never appear in user-facing
  text — they are internal vocabulary only.

## Acceptance criteria

- [ ] Full drive-the-model-from-the-UI pass: invite a member → create a
      custom role from the catalog → assign it → share one note to a guest
      via the share dialog → the guest logs in with phone OTP / magic link
      and sees exactly that note and nothing else.
- [ ] Login screen renders correctly for each `/auth/methods`
      configuration (password-only, OTP-only, password + SSO) and each
      `TWODB_IDENTIFIER` mode.
- [ ] With the verified-only gate on, an unverified login lands on the
      verify screen and cannot reach any workspace route until verified.
- [ ] Switching workspace in the picker changes `useIdentity()` output
      without re-login; an SSE `twodb.identity.role.revoked` fact removes
      the corresponding UI affordance live.
- [ ] The identity provider could be replaced without shell changes:
      demonstrate by registering a stub provider implementing
      `IdentityProvider` in place of `twodb.identity` — the shell boots,
      guards work, and no shell file imports the identity view plugin.
- [ ] Copy audit: no user-facing string contains "claim", "principal", or
      "grant"; every backend 403/409 is shown as a plain-language message.
- [ ] `pnpm build` green; no hardcoded colors/spacing/radii in any new
      style file.

## Out of scope

- Superadmin settings UI (method catalogue config, gate toggle) — task 8.
- The app access panel inside custom apps — task 7.
- Backend work of any kind (tasks 2–7 own it); this task consumes the
  APIs and events they ship.
