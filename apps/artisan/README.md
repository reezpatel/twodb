# Artisan

Coding agent harness for runner-backed directory sessions and configured agents.

## Canvas integration

Artisan exposes an `update_canvas` tool and a Canvas session tab. Artisan stores only canvas metadata and the backing Paintress board id; Paintress owns document content.

- Directory-agent canvases are scoped to the session.
- Configured-agent canvases are scoped to the agent and appear across its sessions.
- New canvases currently create Paintress `doc` boards only.
- The Paintress group uses the session space. Its name is `<runner>-<directory>` for directory agents and the agent id for configured agents.
- Reusing a title replaces the full Markdown document; different titles create multiple canvases.

Shape: `backend+webapp`

Endpoint and message references are generated from `src/manifest.ts` and `src/messages.ts` with `pnpm gen:docs`.
