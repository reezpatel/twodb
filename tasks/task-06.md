# Task 6 — Entity grants & guest access

Plan refs: plan.md §5 (entity grants), §4 (guest role), §9 (enforcement,
bus facts), §11 (API sketch), §12 (share dialog slot)
Depends on: task-05
Status: not started

## Goal

Per-entity claim overrides become real: a user can be granted extra claims on
one entity (a note, later an app or board) layered on top of their roles —
purely additive. This is what makes the `guest` role useful (zero claims plus
explicit grants = an outside person who sees exactly what was shared) and
what turns "reader" into "editor of this one document". It is also the first
real dogfood of the task-4 authz engine: the `twodb.notes` routes start
enforcing claims.

## Deliverables

### 6.1 Migration — `entity_grants`

```text
entity_grants    id 'grt-'…, workspace_id → workspaces,
                 entity_type text, entity_id text,
                 user_id → users, claims jsonb (array of claim strings),
                 granted_by → users, created_at timestamptz default now(),
                 unique (workspace_id, entity_type, entity_id, user_id)
```

- One row per (workspace, entity, user); `claims` is the full set the grant
  currently confers. jsonb stays in v1 (plan §8) — grants are few and small.
- `granted_by` records who shared; used for audit and the share dialog's
  "Shared by …" line.

### 6.2 Grant APIs (`plugins/identity/service/`, under `/api/v1/twodb.identity/`)

| Route | Notes |
| --- | --- |
| `POST /grants` | body `{ workspaceId, entityType, entityId, userId, claims[] }`. If a grant row already exists for that tuple, **merge** (union the claims, update the row, keep the original `created_at`); otherwise insert. Never shrinks claims — revocation is the only path that removes them. |
| `DELETE /grants/:id` | revokes the whole grant row. |
| `GET /grants?workspaceId&entityType&entityId` | per-entity listing — the share dialog's data source. Returns grant rows joined to user name/identifier. |

Every mutation emits its bus fact from the task-1 event map:
`twodb.identity.entity.granted` (payload includes the post-merge claim set)
and `twodb.identity.entity.revoked`. Grant creation for a brand-new tuple and
a merge both emit `entity.granted` — consumers diff the payload.

### 6.3 Privilege-escalation guard

A granter can only confer claims they **themselves hold** on that entity:

```ts
// inside POST /grants, after withWorkspace has run for the granter:
const held = await effectiveClaims(granter, workspaceId, entityType, entityId);
// effectiveClaims = role claims ∪ entity_grants — the task-4 engine output
const shareClaim = shareClaimFor(entityType); // e.g. plugin.twodb.notes:note.share
if (!held.has(shareClaim)) return reply.code(403).send({ error: "You can't share this — ask someone who can." });
const missing = requestedClaims.filter((c) => !held.has(c));
if (missing.length) return reply.code(403).send({ error: "You can only share permissions you have yourself.", missing });
```

- `shareClaimFor(entityType)` resolves via a tiny registry in
  `@twodb/contracts` (`{ "note": "plugin.twodb.notes:note.share", … }`) that
  plugins populate from their manifests — no string assembly in the route.
- Requested claims must also exist in the boot-built claim catalog
  (task 4) — a grant can never invent a claim.
- `DELETE /grants/:id` requires the same entity share claim (you can revoke
  what you could have granted), **or** being the grant's `user_id`
  (self-removal from a share).
- `GET /grants` requires the entity's `read` claim at minimum — the share
  dialog must render read-only for people who can see but not share.

### 6.4 Additive-only evaluation

Effective claims = role claims ∪ entity grants. **No deny-grants in v1**
(plan §5, ▸ decision recorded): a pure union keeps every access answer
explainable in one sentence to a non-technical user ("Asha can edit this
note because she was granted edit on it"). Deny semantics introduce
precedence questions ("role says yes, grant says no — which wins?") that no
user-facing copy survives. Revisit only when a real conflict appears. Add a
one-paragraph note to this effect in `plugins/identity/service/README.md` so
the decision travels with the code.

The task-4 `withWorkspace`/`requireClaim` engine already unions grants into
effective claims when given `{ entity, idParam }` — verify with tests that a
grant row flips a 403 into a 200 with **no route changes**.

### 6.5 Guest invite flow

The guest path composes three existing pieces, nothing new invented:

1. **Invite by identifier** — extend task-5's
   `POST /workspaces/:id/members` to accept `{ identifier, role: "guest" }`.
   A new user row is created if the identifier is unknown (per task-2
   register semantics); the membership carries **only** the guest role —
   zero claims by definition (plan §4).
2. **Grant on the specific entity** — the inviter (or anyone with the
   entity's share claim) then `POST /grants` for that user + entity.
3. **The guest's whole visible world is their grants** — workspace list
   endpoints and the notes list must already be claim-filtered (6.6); a
   guest with one note grant sees that note and literally nothing else in
   the workspace. Assert this in tests, not in prose.

### 6.6 Share dialog — slot contract (backend-adjacent)

The share dialog is a **shell slot** any view plugin can render into its
entity toolbar. This task defines the contract only; the identity view
plugin contributes the actual dialog in task 9.

- Slot name constant `SHARE_SLOT = "share"` in
  `packages/contracts/src/providers.ts` (alongside the task-1 provider slots;
  it is a *contributable* slot — many plugins may render a trigger into
  their own toolbars, exactly one provider — the identity plugin — supplies
  the dialog implementation).
- Contract: the dialog is opened with
  `{ workspaceId, entityType, entityId }`, talks **only** to the §6.2 APIs,
  and receives live updates via the existing SSE bridge on
  `twodb.identity.entity.granted/revoked`.
- Document the contract in `packages/shared-frontend/src/providers.ts`
  (jsdoc on a `ShareDialogProps` type) so task 9 implements against types,
  not convention.

### 6.7 Dogfood — `twodb.notes` claims enforcement

First real consumer of the authz engine. Update
`packages/notes/manifest.ts` to the plan §3 shape (the legacy
`twodb.notes:read/write` permissions are replaced):

```ts
permissions: [
  "plugin.twodb.notes:note.read",
  "plugin.twodb.notes:note.create",
  "plugin.twodb.notes:note.edit",
  "plugin.twodb.notes:note.delete",
  "plugin.twodb.notes:note.share",
],
roleDefaults: {
  manager: [read, create, edit, delete, share], // all five
  editor:  [read, create, edit, share],         // no delete
  reader:  ["plugin.twodb.notes:note.read"],
},
```

Then guard every route in `packages/notes/service/index.ts` with
`withWorkspace` + `requireClaim`:

| Route | Claim | Entity options |
| --- | --- | --- |
| `GET /notes` | `note.read` | none — workspace-scope; response filtered to notes the caller can read (role-wide or via grants) |
| `POST /notes` | `note.create` | none — workspace-scope |
| `GET /notes/:id` | `note.read` | `{ entity: "note", idParam: "id" }` |
| `PATCH /notes/:id` | `note.edit` | `{ entity: "note", idParam: "id" }` |
| `DELETE /notes/:id` | `note.delete` | `{ entity: "note", idParam: "id" }` |

The list route is the subtle one: role-held `note.read` sees everything;
grant-only readers (guests) see exactly their granted notes — implement as
`WHERE id = ANY(readableNoteIds)` with `readableNoteIds` computed from
grants when the claim came from grants alone. This is also when notes move
from the in-memory `Map` to `fastify.pg` (id `nte-…` — register the prefix
in the contracts id registry) since grants need real rows to join against.

## Acceptance criteria

- [ ] A workspace `reader` granted `plugin.twodb.notes:note.edit` on one
      note can `PATCH` that note (200) but gets 403 on every other note and
      still cannot `POST /notes` (no `note.create`).
- [ ] A guest invited with a single note grant sees exactly that note in
      `GET /notes` and 403s on all other note routes and ids — nothing else
      in the workspace is visible.
- [ ] A granter who lacks `plugin.twodb.notes:note.share` on the entity gets
      403 from `POST /grants` with the plain-language error.
- [ ] A granter holding `note.share` but not `note.delete` is rejected (403,
      `missing` listed) when trying to grant `note.delete`.
- [ ] Revoking a grant (`DELETE /grants/:id`) takes effect on the **next**
      request — previously-200 requests 403 immediately, no cache staleness.
- [ ] Re-`POST`ing a grant for an existing tuple merges claims (union),
      returns one row, and emits `entity.granted` with the merged set.
- [ ] Both mutations emit `twodb.identity.entity.granted` / `.revoked` bus
      facts observable on the SSE bridge.
- [ ] Unknown claims in a grant request are rejected against the boot
      catalog.
- [ ] Notes service persists in postgres with `nte-…` ids; all five routes
      claim-guarded; `pnpm build` green.

## Out of scope

- The share dialog **UI** itself and the identity view plugin (task 9) —
  this task ships the slot contract and the backend it talks to.
- Deny-grants / claim subtraction (documented non-goal, §6.4).
- App-level grants (`requireAppClaim` dogfooding) — task 7.
- Grant expiry / time-boxed shares — revisit with audit (task 8+).
