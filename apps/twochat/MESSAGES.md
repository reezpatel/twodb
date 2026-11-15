# MESSAGES.md — TwoChat

> **Generated file — do not hand-edit.** Source of truth is `src/messages.ts` (Zod schemas via `@twodb/core-async/registry`). Regenerate with `pnpm gen:docs`.

_Generated: 2026-11-15T06:16:06.346Z_

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

### `twochat.collab.reply`

From Artisan: a collaborator's reply for a run. Posted as the bot; `isCompleted` is authoritative for closing the task. Dropped when its epoch is older than the task's (rolled back).

- **Direction**: `consumes`
- **Retry notes**: Delivered by the core-async relay (at-least-once); every handler is idempotent on its dedupe key.

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runId": {
      "type": "string"
    },
    "taskId": {
      "type": "string"
    },
    "epoch": {
      "type": "number"
    },
    "messageId": {
      "type": "string"
    },
    "isCompleted": {
      "type": "boolean"
    },
    "outcome": {
      "type": "string",
      "enum": [
        "ok",
        "failed",
        "stopped"
      ]
    }
  },
  "required": [
    "runId",
    "taskId",
    "epoch",
    "messageId",
    "isCompleted",
    "outcome"
  ],
  "additionalProperties": {}
}
```

### `twochat.collab.edit`

From Artisan: the collaborator edited one of its own earlier replies in the same task.

- **Direction**: `consumes`
- **Retry notes**: Delivered by the core-async relay (at-least-once); every handler is idempotent on its dedupe key.

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runId": {
      "type": "string"
    },
    "taskId": {
      "type": "string"
    },
    "epoch": {
      "type": "number"
    },
    "messageId": {
      "type": "string"
    }
  },
  "required": [
    "runId",
    "taskId",
    "epoch",
    "messageId"
  ],
  "additionalProperties": {}
}
```

### `twochat.collab.status`

From Artisan: run state (started | stopped | failed) driving the 'is working' indicator.

- **Direction**: `consumes`
- **Retry notes**: Delivered by the core-async relay (at-least-once); every handler is idempotent on its dedupe key.

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runId": {
      "type": "string"
    },
    "taskId": {
      "type": "string"
    },
    "epoch": {
      "type": "number"
    },
    "state": {
      "type": "string"
    }
  },
  "required": [
    "runId",
    "taskId",
    "epoch",
    "state"
  ],
  "additionalProperties": {}
}
```

### `twochat.collab.bot`

From Artisan: a collaborator agent was created, changed or deleted — mirrored here as a bot (enabled only while it has a runner and directory).

- **Direction**: `consumes`
- **Retry notes**: Delivered by the core-async relay (at-least-once); every handler is idempotent on its dedupe key.

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "agentId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "enabled": {
      "type": "boolean"
    },
    "deleted": {
      "type": "boolean"
    }
  },
  "required": [
    "agentId",
    "name",
    "description",
    "enabled",
    "deleted"
  ],
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

### `twochat.conversation.imported`

Published after external messages are idempotently copied into a read-only conversation in any list group.

- **Direction**: `produces`

**Payload**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "conversationId": {
      "type": "string"
    },
    "inserted": {
      "type": "number"
    },
    "duplicate": {
      "type": "number"
    },
    "importedAt": {
      "type": "string"
    }
  },
  "required": [
    "conversationId",
    "inserted",
    "duplicate",
    "importedAt"
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
