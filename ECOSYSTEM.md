# Twodb Ecosystem

This repo is being rebuilt from a single monolith into an ecosystem of small,
independently deployable apps + shared core libraries. See the architecture
plan (canvas history / `docs/ECOSYSTEM_PLAN.md`) for full rationale. This file
is the quick orientation map.

## Layout

```
twodb/
├── archive/            ← frozen pre-ecosystem monolith (tag v0-monolith-archive)
├── core/                core-data, core-graph, core-async, core-platform, core-runtime
├── blocks/               shared design system + Storybook
├── apps/                 17 apps, each own schema/deploy, talk only through the Gateway (apps/twodb)
└── tools/                scaffolding / codegen scripts
```

## Status (what's real vs scaffolded right now)

All 36 workspace packages build clean (`pnpm install && npx turbo build`).
TwoDB has been boot-tested end to end (bootstraps SQLite, creates every
control-plane + better-auth table, listens, self-registers, serves
auth-guarded routes).

| Area | Status |
|---|---|
| `blocks` | carried forward from the old monolith (Radix/Tailwind/Storybook), convention docs added |
| `core/core-data` | implemented: Postgres+Kysely runtime client, SQLite client, storage abstraction, config loader |
| `core/core-graph` | implemented: thin Memgraph (Neo4j bolt protocol) client wrapper, opt-in |
| `core/core-platform` | implemented: manifest schema + Zod→endpoint.json + ENDPOINTS.md generator, auth (better-auth: passkey + Google + generic OIDC for PocketID + API keys + zero-setup migration), org/workspace/space model, Gateway-internal transport dialer, telemetry |
| `core/core-async` | implemented: Postgres-backed queue + LISTEN/NOTIFY broadcast, generic engine + Zod typed-schema-registry + MESSAGES.md generator |
| `core/core-runtime` | implemented: `twodb-cli` (loads any app's endpoint.json → live CLI), `shell` (tabs/panes runtime + pane-state contract, partials/hooks convention) |
| `apps/twodb` | **implemented** — control plane: zero-setup SQLite bootstrap (incl. better-auth tables), Docker orchestration (install/start/stop/restart/upgrade/remove app containers; static catalog with fixed ports; generic `deploy/docker/app.Dockerfile`), per-app registration tokens (no shared secret; hash-only storage; push + pull registration paths), Postgres schema+role provisioning, Gateway (HTTP routing + streaming proxy + federated search fan-out), admin webapp (passkey login, registry UI) |
| `apps/tworoute` | implemented — LLM gateway: Space-scoped provider connections (openai-compatible + anthropic adapters), streaming `/completions`, workspace-API-key auth |
| all other 15 apps | **scaffolded only** (folder + AGENTS.md/ENDPOINTS.md/MESSAGES.md/README + manifest.ts/messages.ts + starter feature skeleton for webapp ones) — not yet built out, per roadmap Phase 7+. Re-run `pnpm scaffold` any time; it never overwrites files that already exist. |

## Known gaps / deliberately deferred (see each app's README for detail)
- Docker orchestration is host-local (shells out to the `docker` CLI against
  a static in-repo catalog) — no multi-host fleet management, and the admin
  webapp doesn't expose the install/lifecycle buttons yet (API only).
- App releases come from a single repo-wide tag (`vX.Y.Z`); CI publishes
  `ghcr.io/<owner>/app-<slug>` images for just the apps whose code changed
  since the previous tag (shared-code changes release everything; see
  `.github/workflows/release-app.yml`). Nothing builds on `main`. Installs
  use those published images only when `TWODB_APP_IMAGE_REGISTRY` is set;
  otherwise they build locally from the workspace. Old monolith release
  pipelines (twodb-server/runner images, desktop/android/ios builds,
  brew/choco publishes) are retired.

- TwoRoute's connection credentials are stored in plaintext — mirror
  TwoDB's `encryptSecret`/`decryptSecret` helper before real deployment.
- No usage/quota tracking, no OAuth-subscription-based LLM providers.
- Module Federation (true microfrontends) not yet implemented — the shell
  runtime and blocks exist, but no app has been split across build
  boundaries yet.

## Conventions every package/app must follow
1. **Docs-as-code**: every app ships `AGENTS.md`, `ENDPOINTS.md`, `MESSAGES.md` — the
   latter two are generated from Zod schemas (see `core-platform/manifest` and
   `core-async` registry), never hand-edited directly.
2. **UI components**: default home is the owning app. The moment a component is
   needed by a 2nd app (or is obviously generic), move it into `blocks`.
3. **Frontend structure**: one component per file; `partials/` = dumb/presentational
   only; `hooks/` = all business logic, with one "holding" hook per component that
   composes smaller business hooks. See `blocks/CONVENTIONS.md`.
4. **Transport**: apps never talk to each other directly — only through the Gateway
   (`apps/twodb`) over HTTP. No app links a transport library.
5. **Data**: one Postgres schema per app, provisioned by `apps/twodb`, accessed via
   `core-data/db` as a plain runtime client (no provisioning logic in the lib).
