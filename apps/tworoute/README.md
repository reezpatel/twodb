# TwoRoute

Multi-provider LLM gateway. Space-scoped provider connections
(`llm_connection` table, own Postgres schema `tworoute`) plus a streaming
OpenAI-compatible `/completions` endpoint.

## Running it

**As a container (the normal path)** — installed and lifecycle-managed by
TwoDB's orchestrator; no manual env setup at all:

```bash
curl -X POST -H "x-api-key: $KEY" $GW/orchestrator/apps/tworoute/install
curl -H "x-api-key: $KEY" $GW/orchestrator/apps/tworoute/status   # poll until "running"/"active"
```

**Local dev (no Docker)** — get a per-app token + DB from TwoDB first:

```bash
curl -X POST -H "x-api-key: $KEY" $GW/orchestrator/apps/tworoute/provision-db   # → DATABASE_URL
curl -X POST -H "x-api-key: $KEY" $GW/orchestrator/apps/tworoute/issue-token    # → TWODB_PROVISION_TOKEN

DATABASE_URL=... TWODB_PROVISION_TOKEN=... pnpm --filter @twodb/app-tworoute dev
```

There is no shared registration secret anymore: the token is unique to this
app, issued by TwoDB at install time, and only its hash is stored server-
side. In dev mode the app push-registers itself on boot
(`registerWithGateway`); as a container TwoDB pull-registers it by polling
`GET /internal/manifest` (see `core-platform/src/manifest/serve.ts` for why
both paths exist — container→host traffic is firewalled on stock Linux
Docker).

## Endpoints (see generated `ENDPOINTS.md`)
- `POST /connections` — register a provider connection, scoped to a Space.
- `GET /connections` — list connections visible to the caller's active Spaces.
- `POST /completions` — OpenAI-shaped chat completion, streamed straight
  through from whichever provider the resolved connection points at.
  Callable by any app through the Gateway, or directly by an external tool
  (Cursor, etc.) using a workspace API key.

## Providers implemented
- `openai-compatible` — pure pass-through (covers OpenAI, Groq, Together,
  local OpenAI-shim servers, etc).
- `anthropic` — translates to the native Messages API shape.

## Known stubs / not hardened yet
- API keys are stored in plaintext in the `llm_connection` table — mirror
  TwoDB's `encryptSecret`/`decryptSecret` helper here before any real
  deployment.
- No usage/quota tracking yet (the old monolith's `llm.ts` had an elaborate
  per-provider quota-collection system — intentionally not ported; add it
  back only when a concrete app needs it, as `core-async` jobs/events).
- No OAuth-based providers (e.g. "Claude Code" subscription auth) ported
  yet — only API-key-based connections.
