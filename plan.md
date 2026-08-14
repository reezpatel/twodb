# twodb Identity, Tenancy & Access Control — Plan

Status: **draft** — not started. The plugin architecture (thin shell, `view/` +
`service/` plugins, dot-namespaced ids, event-bus-first) is assumed as the
foundation; this plan layers identity, organizations, workspaces, roles, and
custom-app auth on top of it.
Owner decision points are marked ▸. Everything else is the recommended default.

## 1. Goal

One access-control model that covers the whole product:

- A **superadmin** who administers the deployment itself (instance config,
  not content).
- **User accounts** that can join many **organizations**, each organization
  holding many **workspaces**; the same user can belong to any number of both.
- Inside each workspace, **roles** bundle **claims**; workspace managers can
  define **custom roles** by picking claims from a catalog.
- **Custom apps** (built by the AI app builder) carry their own auth: app-level
  roles bundling app-level claims, independent of workspace roles.
- **Entity-level overrides**: a specific user can be granted extra claims on a
  specific entity (a note, an app, a board) without changing their role.

Everything is enforced on the backend; the frontend only reflects it.

## 2. Concepts & hierarchy

```text
deployment (one twodb instance)
└── superadmin(s)                     # deployment config, not content
│
├── organization A                    # billing/ownership boundary
│   ├── workspace A1                  # the collaboration unit; roles live here
│   │   ├── members (users) × roles × claims
│   │   ├── entities (notes, boards, files, …)
│   │   │   └── entity grants (per-user claim overrides)
│   │   └── custom apps
│   │       └── app members × app roles × app claims
│   └── workspace A2 …
└── organization B …
```

| Concept | Scope of its auth | Owned by |
| --- | --- | --- |
| Superadmin | deployment | the instance (env-seeded first admin) |
| User account | none (identity only) | the user |
| Organization | membership + org admin flag | org admins |
| Workspace | roles + claims | workspace owner/managers |
| Entity | additive grants to users | the entity's container (workspace) |
| Custom app | app roles + app claims | the app's workspace |

- A **user** is just an identity — exactly one row per email or phone,
  governed by the deployment's identifier mode (§10). Users hold no claims by
  themselves — claims come from memberships, roles, and grants.
- An **organization** is the ownership/billing boundary. It has members and at
  least one org admin; orgs do **not** get the full role machinery.
  ▸ Org-level roles: keep it to `admin` / `member` (recommended) vs reusing the
  workspace role engine at org scope. Recommended: minimal — orgs manage
  profile, billing, and workspace creation; real work (and real roles) live in
  workspaces.
- A **workspace** is where content and apps live and where the role system
  applies. Every access check happens against exactly one workspace context.

## 3. Claims

A **claim** is a single granular permission string. Claims reuse the plugin
identifier system: every plugin declares its claims in its `manifest.ts`
(the existing `permissions` field becomes the claim source) **and, alongside
them, its preferred claims for each default role**:

```ts
// plugins/notes/manifest.ts
permissions: [
  "plugin.twodb.notes:note.read",
  "plugin.twodb.notes:note.create",
  "plugin.twodb.notes:note.edit",
  "plugin.twodb.notes:note.delete",
  "plugin.twodb.notes:note.share",
],
// what each default role should hold once this plugin is installed
roleDefaults: {
  manager: [
    "plugin.twodb.notes:note.read",
    "plugin.twodb.notes:note.create",
    "plugin.twodb.notes:note.edit",
    "plugin.twodb.notes:note.delete",
    "plugin.twodb.notes:note.share",
  ],
  editor: [
    "plugin.twodb.notes:note.read",
    "plugin.twodb.notes:note.create",
    "plugin.twodb.notes:note.edit",
    "plugin.twodb.notes:note.share",
  ],
  reader: ["plugin.twodb.notes:note.read"],
},
```

`roleDefaults` rules:

- Values must come from the plugin's own `permissions` — a plugin can only
  give away claims it declares. Unknown roles or claims fail boot validation.
- **`owner` is implicit**: it always receives the plugin's full claim set and
  is never listed. **`guest` is never listed**: it holds zero claims by
  definition (§4). So plugins express preferences for `manager`, `editor`,
  `reader` — the three roles where products genuinely differ.
- The identity plugin itself ships `roleDefaults` for the platform claims
  (`plugin.twodb.identity:*`) — that is what makes "manager can manage members
  and roles, editor cannot" concrete instead of hand-written per workspace.

Shape: **`plugin.<plugin_id>:<noun>[.<verb]>`** for plugin claims,
**`app.<app_slug>:<noun>[.<verb]>`** for app claims. The leading `plugin.` /
`app.` names the owning namespace; the id segment keeps claims collision-free
by construction, same as API prefixes, routes, and events. Platform claims
come from the core identity plugin itself
(`plugin.twodb.identity:workspace.manage`,
`plugin.twodb.identity:member.invite`, `plugin.twodb.identity:role.manage`,
…).

The **claim catalog** is built at api boot by collecting every registered
plugin's manifest permissions. The role editor UI and the role APIs both
validate against this catalog — a role can never hold a claim no plugin
declared, and disabling a plugin surfaces which roles reference its claims.

The `plugin.` / `app.` prefix names the claim's **owner**, not its scope:
scope still comes from **where the claim is granted** (workspace role vs app
role vs entity grant), never from the name.

## 4. Workspace roles

A **role** is a named bundle of claims inside one workspace. Default roles are
seeded into every new workspace **from the `roleDefaults` of the installed
plugins** — the table below is the shape, the claims come from manifests:

| Role | Claims | Notes |
| --- | --- | --- |
| `owner` | the entire catalog | every workspace must always have ≥1 owner; only owners can delete the workspace or transfer ownership |
| `manager` | all except workspace-destructive claims | manages members, custom roles, and settings |
| `editor` | create + edit content claims | no member/role/settings management |
| `reader` | `*.read` claims only | read-only participation |
| `guest` | **none** | special — see below |

Rules:

- **Custom roles** — anyone with `plugin.twodb.identity:role.manage`
  (default:
  owner + manager) can create a role with a name and any subset of catalog
  claims. Custom roles are first-class: assignable, editable, deletable (only
  when unassigned or reassigned).
- ▸ Default roles editable? Recommended: **locked** — defaults are system-owned
  so product behavior stays predictable; a manager who wants a variant clones
  one into a custom role.
- **System-managed, manifest-driven.** Locking applies to people, not to the
  system: when a plugin is installed into a workspace, its `roleDefaults`
  claims are merged into that workspace's default roles; when it is disabled,
  they are removed. A plugin upgrade that changes `roleDefaults` reconciles
  the same way. The system only ever mutates **default** roles this way —
  custom roles are user data and are never touched (dangling claims in them
  are surfaced, per §3). Both directions emit bus facts.
- **Guest is special**: the guest role intentionally holds zero claims. A guest
  sees nothing in the workspace by default — every thing a guest can see or do
  comes from an **entity grant** (§5). This makes "invite the accountant to
  just this one ledger app" a first-class flow instead of a permission
  accident.
- A membership must always hold at least one role; removing the last role
  removes the membership. Role changes emit bus facts (§9).

## 5. Entity grants (per-entity overrides)

An **entity grant** gives one user extra claims on one entity, layered on top
of whatever their roles already provide:

```text
entity_grants: (workspace, entity_type, entity_id, user) → claims[]
```

- **Additive only.** Effective claims = role claims ∪ entity grants.
  ▸ Deny-grants (subtract a claim on one entity)? Recommended: **not in v1** —
  allow-only keeps evaluation a pure union, explainable to non-technical users
  ("Asha can edit this note because…"). Revisit when a real conflict appears.
- Grants are how guests get anything at all, and how a reader becomes an
  editor of one document.
- Grants are created through the entity's **Share** surface (a core shell
  slot any plugin can render into), and revoked the same way. Every grant and
  revocation is a bus fact.
- A grant can only confer claims the **granter themselves holds** on that
  entity (plus `share`), so privileges can never escalate outward.

## 6. Custom app auth

A custom app lives inside one workspace and gets an app id (`app.<slug>`,
boot-validated like plugin ids). Its generated manifest declares **app claims**
(`app.ledger:entry.create`, `app.ledger:report.view`, …), which register into
the claim catalog under the app's namespace.

App auth mirrors the workspace model, one level down:

- **App roles** bundle app claims. The same five defaults are seeded per app
  (owner / manager / editor / reader / guest) **from the app manifest's own
  `roleDefaults`** — app manifests declare app claims and their preferred
  default-role mapping exactly like plugins do — and workspace managers can
  define custom app roles from the app's claim set.
- **App role assignments** are per (app, user) and independent of workspace
  roles — being a workspace editor says nothing about any app.
- Workspace owner/manager implicitly hold app-owner on every app in their
  workspace (they can always manage app access); everyone else needs an app
  role — or an entity grant on the app — to use it.
- App claims are only meaningful inside that app: `app.ledger:*` never
  authorizes workspace content, and `plugin.*` claims never authorize app
  actions. The two namespaces meet only in the role engine, which evaluates
  both with the same code.
- Guests compose naturally here: a workspace guest + an app grant = an outside
  person who can open exactly one app and nothing else.

## 7. Superadmin

The superadmin administers the **deployment**, not the tenants:

- First superadmin is seeded from env (`TWODB_SUPERADMIN_EMAIL`) at boot;
  superadmins can promote/demote other superadmins.
- Powers: deployment configuration (features, limits, storage, mail), the
  offered **sign-in methods** and their provider configs (§10), the
  verified-only access gate, listing/suspending organizations, viewing usage
  and health.
- ▸ Content access: recommended — **no implicit access** to org/workspace
  content. Support access, when needed, is an explicit, time-boxed, audited
  "assume role" that lands in the audit log as a fact. Keeps the promise "the
  hoster cannot read your brain" true by construction.

## 8. Data model (Postgres)

**Data layer (decided 2026-08-14):** Postgres is the store; **Kysely** is the
query builder and migration runner for every service plugin — type-safe SQL,
migrations as code, no ORM magic. Each plugin owns its tables and ships its
own Kysely migrations; shared-backend provides the migration runner.

```text
users                id, identifier, email, phone, name, created_at,
                     email_verified_at, phone_verified_at
                     -- identifier = the login key (email or phone, per mode),
                     -- unique, populated at runtime; the schema is mode-independent
user_auth_methods    id, user_id, method, credential, enabled, created_at
                     -- password hash / sso subject link / otp target
deployment_auth_methods  method, config, enabled    -- superadmin-managed
verification_codes   id, identifier, code_hash, purpose, expires_at
sessions             id, user_id, token_hash, auth_method, expires_at, created_at
platform_admins      user_id, granted_by, created_at          -- superadmins

organizations        id, name, slug, created_by, created_at
org_memberships      org_id, user_id, is_admin, created_at

workspaces           id, org_id, name, slug, created_at
workspace_members    workspace_id, user_id, created_at
roles                id, workspace_id, key, name, description, is_system
role_claims          role_id, claim
role_assignments     workspace_id, user_id, role_id

entity_grants        id, workspace_id, entity_type, entity_id,
                     user_id, claims[], granted_by, created_at

apps                 id, workspace_id, slug, name, manifest, created_at
app_roles            id, app_id, key, name, is_system
app_role_claims      app_role_id, claim
app_role_assignments app_id, user_id, app_role_id
```

- `roles.is_system` / `app_roles.is_system` mark the locked defaults.
- `entity_grants.claims` stays a jsonb array in v1 (grants are few and small);
  normalize only if query patterns demand it.
- Graph relationships (org → workspace → entity) can later mirror into
  memgraph for traversal queries, but **Postgres is the system of record** for
  access decisions.

### Entity ids

Every entity's primary key is a **prefixed id**: **`XXX-<base62 uuid>`**.

- `XXX` — a 3-letter code naming the table/entity type (`usr`, `ses`, `org`,
  `wks`, `rol`, `grt`, `app`, …). Lowercase, registered once in
  `@twodb/contracts` so hosts, plugins, and apps share one registry; plugins
  and custom apps register codes for their own entity types in their
  manifests, boot-validated for uniqueness.
- The payload is a UUID v7 (time-ordered, index-friendly) base62-encoded
  (`0-9A-Za-z`, 22 chars). Example: `usr-3k9XQm2vNwP8sL4bRfTdH1`.
- Ids are generated in the service layer via a shared-backend helper
  (`newId("usr")`) — never bare UUIDs, never database sequences — stored as
  text primary keys, and validated against `^[a-z]{3}-[0-9A-Za-z]{22}$`.
- Payoff: an id is self-describing in logs, URLs, bus payloads, and support
  conversations — and a `rol-…` id can never be silently compared against the
  users table.

## 9. Enforcement

**The backend is the only authority.** Three layers, all in
`@twodb/shared-backend` so no plugin re-implements them:

1. **Principal resolution** — the identity service plugin registers a fastify
   `onRequest` hook (the core auth slot): session cookie → `fastify.principal`
   = `{ user, isSuperadmin }` on every request. This hook is the swap
   contract — a replacement identity plugin must deliver the same principal.
2. **Workspace context + claims** — a `withWorkspace` preHandler resolves the
   target workspace (from the route's entity, never from a client-sent header),
   loads the user's roles + assignments once, and computes the request's
   effective claims, cached on the request.
3. **Claim checks** — routes declare what they need:

```ts
fastify.post("/notes", {
  preHandler: [requireClaim("plugin.twodb.notes:note.create")],
}, createNote);

fastify.patch("/notes/:id", {
  preHandler: [requireClaim("plugin.twodb.notes:note.edit", { entity: "note", idParam: "id" })],
}, editNote);   // role claims ∪ entity_grants for this note
```

App routes do the same against the app scope:
`requireAppClaim("app.ledger:entry.create")` resolves the app from the route
and evaluates app roles ∪ grants.

**Frontend** gets `useIdentity()` from the shell (principal + effective claims
for the active workspace, pushed over the existing SSE bridge on change) and
uses it to hide/disable UI. It is cosmetic and never trusted.

**Realtime**: SSE events carry a workspace id; the fan-out only delivers an
event to connections whose principal is a member of that workspace.
▸ Claim-level event filtering (hide e.g. invite events from readers)?
Recommended: membership-level filtering in v1.

All access changes are bus facts in contracts:
`twodb.identity.user.created`, `twodb.identity.workspace.member.added`,
`twodb.identity.role.assigned`, `twodb.identity.role.revoked`,
`twodb.identity.entity.granted`, `twodb.identity.entity.revoked`,
`twodb.identity.app.role.assigned` — so automations and audit can subscribe.

## 10. Identity (authn) & sign-in methods

### Identifiers — one row per person

A user is identified by **email, phone, or both**, chosen per deployment by
env: `TWODB_IDENTIFIER = email | phone | email+phone`. The `users` table
holds **exactly one row per identifier value** — a unique constraint on
`email` (and/or `phone`) is the dedupe boundary. No matter how someone signs
in, a matching identifier lands on the same row: an SSO login for an existing
email **links** to that row (once the SSO provider's claim on the email is
trusted/verified) instead of creating a second account. The identifier mode
is a deployment invariant — changing it later is a migration, not a setting.

### Sign-in methods — two switches per method

Every sign-in method has an on/off switch at **two levels**, and both must be
on for it to work:

1. **Deployment level (superadmin)** — which methods the instance offers at
   all, plus their configuration: `password`, `email_link` (magic link),
   `phone_otp`, and any number of SSO providers (`sso.google`, `sso.azuread`,
   generic OIDC). Stored in `deployment_auth_methods` and editable at runtime
   — adding an SSO provider never needs a redeploy.
2. **User level (each user)** — which of the offered methods work for *their*
   account (`user_auth_methods.enabled`). The canonical flow: superadmin
   configures SSO → the user links their SSO identity → the user disables
   password sign-in for themselves. A user can never disable their **last
   enabled method** (no self-lockout); the superadmin withdrawing a method
   deployment-wide leaves user rows intact but inert.

Method availability follows the identifier mode: `phone_otp` requires a phone
mode, `email_link` requires an email mode; `password` and SSO work with
either.

### Verification

Each identifier carries its own verification (`email_verified_at`,
`phone_verified_at`), set by completing an email-link / phone-OTP challenge
(`verification_codes`). Optional deployment gate — `TWODB_REQUIRE_VERIFIED`
(env-seeded, superadmin-toggleable): when on, sessions for unverified users
are issued but confined to a "verify your email/phone" holding state — no
workspace content, no API beyond verification and session endpoints.
Recommended default for multi-tenant deployments: **on**.

### Sessions

One session shape regardless of method: opaque, httpOnly cookie → `sessions`
table (token hash, expiry). The method used is recorded on the session
(`auth_method`) for audit and future step-up rules. The same login serves
every org/workspace — switching workspace is a shell concern (a picker fed by
the user's memberships), never a re-login.

## 11. API surface sketch (identity plugin, `twodb.identity`)

```text
POST   /api/v1/twodb.identity/auth/login | /logout
GET    /api/v1/twodb.identity/auth/session
GET    /api/v1/twodb.identity/auth/methods            # methods this deployment offers
POST   /api/v1/twodb.identity/auth/verify             # request + confirm code/link

GET    /api/v1/twodb.identity/me/auth-methods         # my methods + enabled flags
POST   /api/v1/twodb.identity/me/auth-methods         # set password / link SSO identity
PATCH  /api/v1/twodb.identity/me/auth-methods/:id     # enable/disable (never the last one)
GET    /api/v1/twodb.identity/me/memberships          # orgs + workspaces for the picker

POST   /api/v1/twodb.identity/orgs                    # create org (+first workspace)
POST   /api/v1/twodb.identity/workspaces              # create workspace in org
GET    /api/v1/twodb.identity/workspaces/:id/members
POST   /api/v1/twodb.identity/workspaces/:id/members  # invite (email → guest or role)
DELETE /api/v1/twodb.identity/workspaces/:id/members/:userId

GET    /api/v1/twodb.identity/workspaces/:id/roles    # incl. claim catalog for the editor
POST   /api/v1/twodb.identity/workspaces/:id/roles    # custom role
PATCH  /api/v1/twodb.identity/roles/:roleId
POST   /api/v1/twodb.identity/workspaces/:id/assignments

POST   /api/v1/twodb.identity/grants                  # entity grant (share)
DELETE /api/v1/twodb.identity/grants/:id

GET    /api/v1/twodb.identity/apps/:appId/roles
POST   /api/v1/twodb.identity/apps/:appId/assignments
```

Superadmin endpoints live under `/api/v1/twodb.identity/admin/…` and require
`isSuperadmin` — they never touch workspace content tables:

```text
GET/PUT /api/v1/twodb.identity/admin/auth-methods     # offered methods + provider configs
PUT     /api/v1/twodb.identity/admin/access-policy    # verified-only gate on/off
```

## 12. Frontend surfaces

- **Workspace picker** in the shell sidebar (org → workspace), fed by
  `me/memberships`; the active workspace drives `useIdentity()`.
- **Members & roles** settings section (contributed by the identity view
  plugin through the existing `settings` slot): member list with role
  assignment, role editor = name + claims checklist from the catalog.
- **Share dialog** — a shell slot plugins render into their entity toolbars;
  creates/revokes entity grants and is the only place guests appear.
- **App access panel** inside each custom app's settings — app roles and
  assignments, same checklist UI against the app's claim set.
- **Sign-in & security** user settings section — my sign-in methods with
  per-method on/off (never the last one), link an SSO identity, identifier
  verification status with resend.
- **Superadmin auth settings** — the method catalogue with provider config
  forms (OIDC client id/secret, SMTP/SMS senders), and the verified-only
  access gate.
- All copy plain-language (Product Principle 1): "can edit", "can only look",
  never the word "claim" in user-facing text.

### Provider slots — replaceable core surfaces

Some shell surfaces are **provider slots**: exactly one view plugin fills each
slot, declared with a `provider` key in its view manifest
(`provider: "identity"`, `"footer"`, `"taskbar"`, …). Control of the slots
lives in one shared place — slot names as constants in
`packages/contracts/src/providers.ts`, registration/lookup/swap logic in
`@twodb/shared-frontend` — so the whole identity experience (or the footer,
or the taskbar) can be replaced tomorrow by uninstalling one plugin and
installing another that claims the same slot. Boot validates: at most one
active provider per slot, and required slots (`identity`) must be filled.
The identity view plugin is the first provider: `provider: "identity"`.

The service side swaps the same way — through contracts, not imports: whoever
owns auth must register the `onRequest` principal hook and honor the
claim/role DTOs; the rest of the system never imports the identity plugin
directly.

## 13. Implementation sequence

1. **contracts** — claim/role/grant DTOs, `twodb.identity.*` event map entries,
   claim-catalog types, the id-prefix registry.
2. **identity service plugin** — users keyed by identifier mode, sessions,
   password login first; orgs, workspaces, memberships; migrations for §8's
   core tables. Then `user_auth_methods` + `deployment_auth_methods` and the
   verification flow (codes, verified_at, the optional gate).
3. **authz in shared-backend** — `fastify.principal`, `withWorkspace`,
   `requireClaim`; claim catalog built from manifests at boot.
4. **roles** — default-role seeding on workspace creation driven by plugin
   `roleDefaults` (incl. the identity plugin's platform mapping), install/
   disable reconciliation, role CRUD + assignments, members API.
5. **entity grants + guest** — grants table/API, Share dialog slot, guest
   invite flow.
6. **custom app auth** — app roles seeded from app manifests,
   `requireAppClaim`, app access panel.
7. **superadmin** — `platform_admins`, deployment-config surface (incl. the
   sign-in method catalogue and verified-only gate), org suspend/list.
   Audited assume-role only if demanded.
8. **frontend wiring** — workspace picker, `useIdentity()`, members & roles
   settings section.

## 14. Hard rules

1. The backend is the only authority; frontend claim checks are cosmetic.
2. Claims come only from manifests, namespaced by owner —
   `plugin.<plugin_id>:<noun>[.<verb]>` for plugins,
   `app.<app_slug>:<noun>[.<verb]>` for custom apps. Every manifest also
   declares its `roleDefaults` — its preferred claims
   for the default roles (`owner` implicit-all, `guest` always-none). The
   boot-built catalog is the single source of truth — nothing freelances
   claim names.
3. Roles never cross workspaces; `app.*` claims never authorize workspace
   content and `plugin.*` claims never authorize app actions. Scope comes
   from where a claim is granted, never from its name.
4. Grants are additive-only; a granter can only confer claims they hold.
5. Guest means zero implicit claims — every guest capability is an explicit
   grant.
6. A workspace always has at least one owner; a membership always has at
   least one role.
7. Default roles are system-managed from manifests: plugin install/disable/
   upgrade reconciles their claims into default roles only — custom roles are
   user data, never mutated by the system.
8. Every access change (assign, revoke, grant, ungrant) is a bus fact typed
   in `@twodb/contracts`.
9. Superadmin configures the deployment; it is not a backdoor into tenant
   content.
10. One `users` row per identifier value — sign-in methods and SSO identities
   link to that row, they never create a second one.
11. A sign-in method works only when enabled at **both** levels (deployment
    and user); a user can never disable their last enabled method.
12. When the verified-only gate is on, an unverified session reaches the
    verification endpoints and nothing else.
13. All entity ids are `XXX-<base62 uuid>` with a prefix from the contracts
    registry — no bare UUIDs, no sequential ints, no untyped ids.
