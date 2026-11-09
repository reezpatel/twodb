# TwoChat

Chat/messenger. **Status: scaffolded only** — not yet implemented (see the
ecosystem roadmap, Phase 7+). This folder has the doc-generation pipeline
(`src/manifest.ts`, `src/messages.ts`, `scripts/gen-docs.ts`) wired up and
ready; the actual routes/UI are not written yet.

Shape: `backend+webapp`

## Before building this out
1. Read `AGENTS.md` in this folder.
2. Look at `apps/twodb` (backend+webapp) or `apps/tworoute` (backend-only)
   as fully worked examples of the same pipeline.
3. Write real `defineEndpoint(...)` entries in `src/manifest.ts`, implement
   them in a fastify server under `src/`, then run `pnpm gen:docs`.
