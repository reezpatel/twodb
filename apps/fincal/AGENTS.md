# AGENTS.md — Fincal
- Declare every endpoint with `route()` (src/lib/route.ts) in src/routes/*; the manifest derives from `allRoutes`. Run `pnpm gen:docs` after changes.
- Isolation: every table carries `workspace_id` + `space_id`. ALWAYS filter by both (use `scoped()` in lib/scope.ts); never query by bare id. All workspace members have full access to every space.
- Money is `numeric(16,2)`; pg returns strings → `toApi` converts known numeric columns to numbers.
- Valuation (FD/RD/stocks/…): lib/valuation.ts. Retirement math: lib/retirement.ts. Client-side calculators: webapp/src/lib/calc.ts.
- Webapp follows blocks/CONVENTIONS.md: holding hook per page (`use*Page.ts`), dumb partials.
