# MESSAGES.md — Toolkit

> **Generated file — do not hand-edit.** Source of truth is `src/messages.ts` (Zod schemas via `@twodb/core-async/registry`). Regenerate with `pnpm gen:docs`.

_Generated: 2026-11-17T06:27:28.312Z_

## Queue jobs

_No queue jobs declared yet._

## Broadcast events

### `toolkit.connector.event`

A connector instance emitted a broadcast event.

- **Direction**: `produces`

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "instanceId": {
      "type": "string"
    },
    "templateId": {
      "type": "string"
    },
    "event": {
      "type": "string"
    },
    "payload": {}
  },
  "required": [
    "instanceId",
    "templateId",
    "event",
    "payload"
  ],
  "additionalProperties": false
}
```
