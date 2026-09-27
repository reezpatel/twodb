# twodb

pnpm-workspace monorepo: a Tauri 2 desktop app, a Hono server, and an outbound runner.

## Projects

| Path           | Name             | Description                                            | Port |
| -------------- | ---------------- | ------------------------------------------------------ | ---- |
| `apps/desktop` | `@twodb/desktop` | Tauri 2 + React 19 + Vite app (shadcn/ui, Tailwind v4) | 5173 |
| `apps/server`  | `@twodb/server`  | Hono backend — Postgres (Kysely), Memgraph, MinIO      | 3001 |
| `apps/runner`  | `@twodb/runner`  | Outbound runner agent (dials home over WebSocket)      | —    |

Apps currently shipping in the desktop shell: Overview, Email, Calendar,
Notes, Chat, Code, Assistant, Meetings, Automations, Files, Settings.

## Getting started

```sh
pnpm install
pnpm db:up        # postgres + memgraph via docker compose
pnpm local        # desktop (:5173) + server (:3001)
```

Run pieces individually:

```sh
pnpm --filter @twodb/desktop dev          # vite
pnpm --filter @twodb/desktop tauri:dev    # full Tauri shell
pnpm --filter @twodb/server dev           # server with watch
pnpm --filter @twodb/runner dev           # runner agent
```

## LLM providers

Connections are managed in Settings → LLM. The server keeps a declarative
provider registry (`apps/server/src/lib/llm-providers.ts`) — Anthropic,
OpenAI (incl. Codex), Claude Code, Gemini, Kimi, GLM, MiniMax, Cline, Kilo
Code, Ollama (self-hosted + cloud), OpenRouter, DeepSeek, Groq, Mistral,
Together, xAI, Cerebras, Fireworks, Cloudflare Workers AI, and anything
OpenAI-compatible. Chat runs server-side over three wire protocols
(anthropic / openai / responses) with streaming and tool use; OAuth token
refresh is built in for Claude Code and Codex. Adding a provider is one
registry entry.

## Docker

CI (`.github/workflows/docker-image.yaml` on every push to `main`, plus tag
builds in `release.yml`) builds and pushes two images to GHCR:

- `ghcr.io/<owner>/twodb` — server with the built desktop app baked in: the UI
  is served at `/` and the API under `/api` (twodb schema ensured on start)
- `ghcr.io/<owner>/twodb-runner` — runner agent, from `apps/runner/Dockerfile`

Run the server (needs postgres + memgraph reachable):

```sh
docker run -p 3001:3001 \
  -e TWODB_DATABASE_URL=postgres://twodb:twodb@host:5432/twodb \
  -e MEMGRAPH_URL=bolt://host:7687 \
  -e BETTER_AUTH_SECRET=change-me \
  -e BETTER_AUTH_URL=http://your-host:3001 \
  ghcr.io/reezpatel/twodb:latest
```

Run a runner next to it (`docker-compose.runner.yaml` does the same):

```sh
docker run -d --network host \
  -e TWODB_SERVER_URL=http://your-host:3001 \
  -e TWODB_RUNNER_KEY=twr_… \
  ghcr.io/reezpatel/twodb-runner:latest
```

Desktop bundles (.deb/.AppImage/.rpm) are attached to each release tag
(`release.yml` → `desktop` job, via tauri-action).

## Nix

The repo ships a flake with a package and a NixOS module — see `NIXOS.md`
for the full module reference. Short version:

```nix
inputs.twodb.url = "github:reezpatel/twodb";

services.twodb = {
  enable = true;
  environment = {
    DATABASE_URL = "postgres://twodb:twodb@localhost:5432/twodb";
    MEMGRAPH_URL = "bolt://localhost:7687";
  };
};
```

Note: when `pnpm-lock.yaml` changes, regenerate the `pnpmDeps` hash in
`nix/package.nix` (build once and copy the `got:` hash from the error).

---

[ TWO_DB_CONTROLLER ] -> Frontend, API

- [ TWO_DB_NODE ] -> Role: StorageProvider - Providers storages, nodes balances themselves
  - Role: ExecutionProvider - Provides a surface to execute code and host code
  - Role: JobProvider - Provides runner to execute jobs.. (serverless env)
