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
  `name` is unique per workspace (CLI/tests address connections by it); the
  API key is encrypted at rest (AES-256-GCM keyed off `TWODB_DATA_KEY`).
- `GET /connections` — list connections visible to the caller's active
  Spaces (workspace-wide when there's no space filter). Keys never returned.
- `PATCH /connections/:id` — update name/base URL/default model, or rotate
  the key.
- `DELETE /connections/:id` — delete; usage history is kept.
- `POST /connections/:id/test` — smoke-test without burning a completion
  (lists models when the provider supports it, else a 1-token ping).
- `GET /connections/:id/models` — live model listing (OpenAI shape; 422 for
  providers without a listing API).
- `GET /usage?days=N` — token-usage summary per connection+model.
- `POST /completions` — OpenAI-shaped chat completion. Non-streaming
  requests are usage-logged and emit the `llm.completion.recorded` broadcast
  event; `stream: true` is a raw pass-through. Callable by any app through
  the Gateway, or directly by an external tool (Cursor, etc.) using a
  workspace API key.

## Providers implemented
- `openai-compatible` — pure pass-through (covers OpenAI, Groq, Together,
  local OpenAI-shim servers, etc).
- `anthropic` — translates to the native Messages API shape.

## Known stubs / not hardened yet
- Encryption at rest is AES-256-GCM keyed off `TWODB_DATA_KEY` (stable
  per-app key injected by TwoDB's orchestrator) — fine for self-hosted/dev,
  replace with a real secrets manager before any serious multi-tenant
  deployment.
- Streaming completions are raw pass-through and NOT usage-logged (the SSE
  token counts would need interception; deliberately deferred) — only
  non-streaming calls feed `/usage` and the `llm.completion.recorded` event.
- No quota enforcement yet (usage is recorded, not limited).
- No OAuth-based providers (e.g. "Claude Code" subscription auth) ported
  yet — only API-key-based connections.
