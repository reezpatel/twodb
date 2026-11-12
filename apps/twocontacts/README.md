# TwoContacts

Working initial slice of the legacy contacts app: Postgres-backed address books,
contact CRUD, case-insensitive search, favorites, and recipient suggestions.
A standalone React webapp provides book creation, search, and contact editing.

## Run

- Backend: `pnpm --filter @twodb/app-twocontacts dev` (port 6404).
- Webapp: `pnpm --filter @twodb/app-twocontacts-webapp dev` (port 6517).
- Set `TWOCONTACTS_DATABASE_URL` or `DATABASE_URL`; otherwise the backend requests
  provisioned credentials from TwoDB using `TWODB_PROVISION_TOKEN`.
- The `twocontacts` schema must already exist (provision through TwoDB).
- `TWODB_GATEWAY_URL` defaults to `http://localhost:6400`; register the app and
  sign in to TwoDB with an active workspace and at least one accessible space.
- The webapp proxies `/apps/twocontacts`, `/api`, and `/registry` to the Gateway.
  Production hosting must provide equivalent same-origin proxy routing.

## Boundaries

Books belong to a workspace and space. Every contact query and mutation checks
both via Gateway-resolved `x-twodb-*` headers. No spaces means no access. Backend
ports are trusted Gateway-internal services: do not expose them to untrusted
clients able to forge these headers. Email uniqueness is per book and is enforced
by a database index after lower-case normalization.

Contacts contain name, email, phone, company, notes, and favorite state. Lists
support `bookId`, `q`, `limit`, and `offset`; the UI shows at most 200 results and
asks users to refine search. Suggestions return at most 10 records, favorites first.
Deletion is permanent and the UI asks for confirmation.

## Verification

```sh
pnpm --filter @twodb/app-twocontacts build
pnpm --filter @twodb/app-twocontacts gen:docs
pnpm --filter @twodb/app-twocontacts-webapp build
TEST_DATABASE_URL=postgresql://.../disposable_database pnpm --filter @twodb/app-twocontacts exec tsx scripts/smoke.ts
```

The smoke test creates and removes an isolated schema, exercising CRUD, validation,
duplicate handling, suggestions, registration token checks, and cross-workspace /
cross-space read and write isolation. Use a disposable database with schema creation
permission.

## Not implemented yet

This is not full legacy parity. Email/calendar contact learning, account-linked
books, organization-member suggestions, hidden/forgotten contacts, activity scores,
merge/import/export, book editing/deletion, and provider sync remain to be ported.
TwoMail and TwoDay integrations must use Gateway APIs, never direct database access.
