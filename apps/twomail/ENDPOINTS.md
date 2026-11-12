# ENDPOINTS.md — TwoMail

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

IMAP inbox and SMTP mail with encrypted account credentials.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twomail`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T18:05:26.797Z_

## Endpoints

### `GET /accounts` — listAccounts

List accounts in accessible spaces; secrets never returned.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "spaceId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "address": {
        "type": "string"
      },
      "createdAt": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "spaceId",
      "name",
      "address",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /accounts` — createAccount

Verify IMAP and SMTP credentials, then save encrypted connection. TLS mandatory.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "note": "could not convert schema to JSON Schema",
  "error": "Error: Transforms cannot be represented in JSON Schema"
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "spaceId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "address": {
      "type": "string"
    },
    "createdAt": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "spaceId",
    "name",
    "address",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `POST /accounts/:id/sync` — syncInbox

Fetch latest 100 INBOX messages (max 2 MB each). Snapshot import, not full mailbox reconciliation.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "imported": {
      "type": "number"
    }
  },
  "required": [
    "imported"
  ],
  "additionalProperties": false
}
```

### `GET /messages` — listMessages

Query accountId, folder (inbox/sent), limit and offset. Plain text only; attachments omitted.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "accountId": {
        "type": "string"
      },
      "folder": {
        "type": "string"
      },
      "sender": {
        "type": "string"
      },
      "recipient": {
        "type": "string"
      },
      "subject": {
        "type": "string"
      },
      "text": {
        "type": "string"
      },
      "date": {
        "type": "string"
      },
      "status": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "accountId",
      "folder",
      "sender",
      "recipient",
      "subject",
      "text",
      "date",
      "status"
    ],
    "additionalProperties": false
  }
}
```

### `POST /send` — sendMail

Send plain text to one recipient. requestId prevents duplicate submissions. Unknown delivery is never automatically retried.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "accountId": {
      "type": "string",
      "minLength": 1
    },
    "requestId": {
      "type": "string",
      "format": "uuid",
      "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    "to": {
      "type": "string",
      "format": "email",
      "pattern": "^(?:[A-Za-z0-9_'+\\-]+\\.)*[A-Za-z0-9_'+\\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"
    },
    "subject": {
      "type": "string",
      "maxLength": 998
    },
    "text": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100000
    }
  },
  "required": [
    "accountId",
    "requestId",
    "to",
    "subject",
    "text"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "accountId": {
      "type": "string"
    },
    "folder": {
      "type": "string"
    },
    "sender": {
      "type": "string"
    },
    "recipient": {
      "type": "string"
    },
    "subject": {
      "type": "string"
    },
    "text": {
      "type": "string"
    },
    "date": {
      "type": "string"
    },
    "status": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "accountId",
    "folder",
    "sender",
    "recipient",
    "subject",
    "text",
    "date",
    "status"
  ],
  "additionalProperties": false
}
```
