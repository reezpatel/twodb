# TwoDay

Initial local-calendar implementation, based on the legacy calendar's distinction
between timed events and date-only all-day events. Not full legacy parity.

## Implemented

- Space/workspace-scoped calendars and persistent Postgres event CRUD.
- Timed events with offset-aware input normalized to UTC; all-day events with
  date-only start and exclusive end.
- Bounded overlapping-event queries, with limit/offset pagination.
- React agenda by month, calendar creation, event editor, deletion confirmation.
- Gateway push/pull registration and generated endpoint docs.

## Run

Backend: `pnpm --filter @twodb/app-twoday dev` (6403).
Webapp: `pnpm --filter @twodb/app-twoday-webapp dev` (6502).

Set `TWODAY_DATABASE_URL` or `DATABASE_URL` to the provisioned database with an
existing `twoday` schema. Otherwise credentials are requested from TwoDB using
`TWODB_PROVISION_TOKEN`. `TWODB_GATEWAY_URL` defaults to http://localhost:6400.
Sign in to TwoDB with an active workspace and accessible space. The webapp proxies
`/apps/twoday`, `/registry` and `/api` through the Gateway. Production static hosting
must provide equivalent routes. Backend ports must remain internal: identity headers
are trusted only because requests arrive from the Gateway.

## Verify

```
pnpm --filter @twodb/app-twoday build
pnpm --filter @twodb/app-twoday gen:docs
pnpm --filter @twodb/app-twoday-webapp build
TEST_DATABASE_URL=postgresql://.../disposable_database pnpm --filter @twodb/app-twoday exec tsx scripts/smoke.ts
```

Smoke tests use an isolated temporary schema and exercise CRUD, invalid intervals,
all-day exclusive ends, timestamp offset normalization, registration protection and
workspace/space isolation. Backend and frontend builds and these Postgres tests pass.
Browser interaction has not yet been verified.

## Limitations / remaining work

No provider connections or sync, recurrence, invitations/RSVP, reminders, free/busy,
trash, calendar editing/deletion, ICS import/export, or contact integration yet.
Event deletion is permanent. All users with access to a space can edit its local
calendars. The agenda displays up to 500 events per month and uses browser-local time;
the API range boundaries are UTC dates. No concurrent edit conflict detection yet.
