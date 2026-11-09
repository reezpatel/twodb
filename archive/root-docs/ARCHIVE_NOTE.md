# Archive — Pre-Ecosystem Monolith

This folder holds everything from the original single-app `twodb` monolith
(`apps/desktop`, `apps/server`, `apps/node`, `apps/runner`, `apps/extension`,
`packages/blocks`, `packages/runner-core`, plus root docs/Dockerfiles/compose
files that described that app).

It is frozen as of tag `v0-monolith-archive` on `main`. The ecosystem rebuild
(see root `ECOSYSTEM.md`) lives in `core/`, `blocks/`, and `apps/*` at the repo
root going forward. Code here may still be referenced for porting logic (e.g.
the existing `packages/blocks` design tokens/components, the existing agent
harness implementation that Artisan/Membrain will draw from) but should not be
built or deployed as-is anymore.
