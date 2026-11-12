# MESSAGES.md — TwoChat

> **Generated file — do not hand-edit.** Source of truth is `src/messages.ts` (Zod schemas via `@twodb/core-async/registry`). Regenerate with `pnpm gen:docs`.

_Generated: 2026-11-12T13:23:28.520Z_

## Queue jobs

### `twochat.read_state.sweep`

Maintenance sweep (hourly): recomputes unread counts from read cursors. Unread counts are computed lazily per request today; this job exists as the future fan-out point for badge counts to offline clients.

- **Direction**: `produces+consumes`
- **Retry notes**: Idempotent; safe to retry.

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "workspaceId": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

## Broadcast events

### `twochat.message.posted`

Published on every new message (human or bot) — envelope only (ids + channel), not the full payload. Future consumers: push delivery, agent listeners that react to channels they're in.

- **Direction**: `produces`

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "messageId": {
      "type": "string"
    },
    "channelId": {
      "type": "string"
    },
    "authorType": {
      "type": "string",
      "enum": [
        "user",
        "bot"
      ]
    },
    "authorId": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdAt": {
      "type": "string"
    }
  },
  "required": [
    "messageId",
    "channelId",
    "authorType",
    "authorId",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `twochat.message.action`

Published when a user clicks a button in a bot-authored composed message. The click is also durable in the bot's GET /bots/actions inbox.

- **Direction**: `produces`

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "messageId": {
      "type": "string"
    },
    "channelId": {
      "type": "string"
    },
    "botId": {
      "type": "string"
    },
    "actionId": {
      "type": "string"
    },
    "value": {
      "type": [
        "string",
        "null"
      ]
    },
    "userId": {
      "type": "string"
    },
    "acknowledgedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdAt": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "messageId",
    "channelId",
    "botId",
    "actionId",
    "value",
    "userId",
    "acknowledgedAt",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `twochat.notification.created`

Published when a user notification is created (mention, DM, bot post) — the hook for future push/email delivery.

- **Direction**: `produces`

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "notificationId": {
      "type": "string"
    },
    "userId": {
      "type": "string"
    },
    "kind": {
      "type": "string",
      "enum": [
        "mention",
        "dm",
        "channel",
        "bot-post",
        "system"
      ]
    },
    "channelId": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdAt": {
      "type": "string"
    }
  },
  "required": [
    "notificationId",
    "userId",
    "kind",
    "channelId",
    "createdAt"
  ],
  "additionalProperties": false
}
```
