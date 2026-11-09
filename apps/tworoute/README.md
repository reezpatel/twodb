# TwoRoute

Multi-provider LLM gateway. Space-scoped provider connections
(`llm_connection` table, own Postgres schema `tworoute`) plus a streaming
OpenAI-compatible `/completions` endpoint.

```bash
pnpm --filter @twodb/app-tworoute dev
```

Requires its own `DATABASE_URL` (the connection string TwoDB's
`POST /registry/apps/tworoute/provision` returns) and `TWODB_PROVISION_TOKEN`
(== TwoDB's `AUTH_SECRET`, for self-registration).

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
