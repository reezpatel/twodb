# MESSAGES.md — TwoDB

> **Generated file — do not hand-edit.** Source of truth is `src/messages.ts` (Zod schemas via `@twodb/core-async/registry`). Regenerate with `pnpm gen:docs`.

_Generated: 2026-11-12T19:52:06.916Z_

## Queue jobs

_No queue jobs declared yet._

## Broadcast events

### `twodb.app.registered`

Published whenever an app (re-)registers itself with TwoDB — e.g. after a deploy/restart.

- **Direction**: `produces`

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "version": {
      "type": "string"
    }
  },
  "required": [
    "slug",
    "name",
    "version"
  ],
  "additionalProperties": false
}
```
