# MESSAGES.md — TwoRoute

> **Generated file — do not hand-edit.** Source of truth is `src/messages.ts` (Zod schemas via `@twodb/core-async/registry`). Regenerate with `pnpm gen:docs`.

_Generated: 2026-11-10T19:30:06.394Z_

## Queue jobs

_No queue jobs declared yet._

## Broadcast events

### `llm.completion.recorded`

One completed LLM call, with token counts — the basis for any future quota/billing.

- **Direction**: `produces`

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "connectionId": {
      "type": "string"
    },
    "model": {
      "type": "string"
    },
    "inputTokens": {
      "type": [
        "number",
        "null"
      ]
    },
    "outputTokens": {
      "type": [
        "number",
        "null"
      ]
    },
    "latencyMs": {
      "type": "number"
    },
    "status": {
      "type": "string",
      "enum": [
        "ok",
        "error"
      ]
    }
  },
  "required": [
    "connectionId",
    "model",
    "inputTokens",
    "outputTokens",
    "latencyMs",
    "status"
  ],
  "additionalProperties": false
}
```
