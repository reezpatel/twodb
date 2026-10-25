# Teams bridge

Read-only Microsoft Teams integration: a runner hosts a persistent Chromium
session per watched Teams account and forwards incoming messages, mentions,
and calls into twodb notifications. Replies happen in Teams itself — every
notification carries an "Open in Teams" deep link.

## How it works

```
Settings → Teams (add account, pick runner)
        │  POST /api/teams/accounts
        ▼
server  ── teamsStart ──▶  runner: Chromium profile ~/.twodb/teams/<accountId>
        │                       ├── user page   (live view target, sign-in)
        │                       └── worker page (scrapes activity feed + chat list)
        ◀── teamsStatus / teamsEvent / teamsLiveFrame ──
        ▼
notifications: teams.message · teams.mention · teams.call · teams.auth
```

- **Sign-in / 2FA** — when the session needs interactive login the account
  goes `auth_required` and you get a high-urgency notification. Settings →
  Teams → **Connect** opens the live view: a JPEG screencast of the runner's
  browser with click/keyboard forwarding, relayed over the runner's control
  socket (`/api/teams/live`). Log in once; the profile persists.
- **Calls** — a fast (4s) poll watches for the incoming-call toast →
  `teams.call` (critical). Disappearing toast → "call ended"; a missed-call
  entry follows from the activity feed.
- **Messages** — the worker page polls the activity feed + unread chat list
  every 30s; events dedupe by stable id (persisted in the profile dir).
  `TWODB_TEAMS_DEBUG=1` dumps scraped payloads and sniffed API responses into
  `<profile>/debug-api/` for selector tuning.

## Runner setup

Chromium must be available to the runner:

- **Docker** (`docker-compose.runner.yaml`) — the image bundles Chromium
  (`playwright install --with-deps chromium`); profiles persist in the
  `teams-profiles` volume.
- **Bare metal** — `npx playwright install chromium` (plus `--with-deps` on
  Debian/Ubuntu), or point `TWODB_TEAMS_CHROMIUM_PATH` at a system Chromium.
  On NixOS use `nixpkgs#playwright-driver.browsers` and export
  `PLAYWRIGHT_BROWSERS_PATH` before starting the runner.
- The embedded local runner can't host Teams sessions — bind accounts to a
  standalone runner.

Env: `TWODB_TEAMS_PROFILE_ROOT` (default `~/.twodb/teams`),
`TWODB_TEAMS_CHROMIUM_PATH`, `TWODB_TEAMS_HEADFUL=1` (debug),
`TWODB_TEAMS_DEBUG=1` (payload dumps).

Smoke test (no Teams account needed — verifies launch, auth detection,
screencast, input): `pnpm --filter @twodb/runner smoke:teams`.

## Selector maintenance

All Teams DOM knowledge lives in `apps/runner/src/teams/selectors.ts`. When
Teams changes its markup: run the runner with `TWODB_TEAMS_DEBUG=1`, inspect
the dumps, fix selectors there.
