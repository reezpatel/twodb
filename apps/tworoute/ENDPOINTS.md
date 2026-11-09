# ENDPOINTS.md — TwoRoute

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Multi-provider LLM gateway: Space-scoped provider connections plus a streaming OpenAI-compatible /completions endpoint any app — or any external tool with a workspace API key — can call.

- **Shape**: backend
- **Base path (via Gateway)**: `/apps/tworoute`
- **Capabilities**: none
- **Core deps**: core-data, core-platform

_Generated: 2026-11-09T15:32:50.940Z_

## Endpoints

### `GET /connections` — listConnections

Lists LLM provider connections visible to the caller's active spaces.

- **Auth**: `session`

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
      "name": {
        "type": "string"
      },
      "provider": {
        "type": "string"
      },
      "default_model": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "name",
      "provider",
      "default_model"
    ],
    "additionalProperties": false
  }
}
```

### `POST /connections` — createConnection

Registers a new LLM provider connection, scoped to one space.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "spaceId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "provider": {
      "type": "string",
      "enum": [
        "openai-compatible",
        "anthropic"
      ]
    },
    "baseUrl": {
      "type": "string"
    },
    "apiKey": {
      "type": "string"
    },
    "defaultModel": {
      "type": "string"
    }
  },
  "required": [
    "spaceId",
    "name",
    "provider",
    "baseUrl",
    "apiKey"
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
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

### `POST /completions` — completions

OpenAI-compatible chat completions endpoint. Pick a connection via `connectionId`, or the first connection visible in-scope if omitted. Any external tool (e.g. Cursor) can point at this using a workspace API key, same as an internal app would.

- **Auth**: `session-or-apiKey`
- **Streaming**: yes (chunked/SSE response)

**Request**
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
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "role": {
            "type": "string",
            "enum": [
              "system",
              "user",
              "assistant"
            ]
          },
          "content": {
            "type": "string"
          }
        },
        "required": [
          "role",
          "content"
        ],
        "additionalProperties": false
      }
    },
    "stream": {
      "type": "boolean"
    },
    "temperature": {
      "type": "number"
    },
    "max_tokens": {
      "type": "number"
    }
  },
  "required": [
    "model",
    "messages"
  ],
  "additionalProperties": false
}
```

### `GET /internal/manifest` — internalManifest

Pull-registration endpoint TwoDB's orchestrator polls on this app's published port after starting its container. Guarded by the per-app registration token via the `x-registration-token` header (shared contract in core-platform/src/manifest/serve.ts) — not callable through the Gateway.

- **Auth**: `public`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    },
    "httpUrl": {
      "type": "string"
    },
    "manifest": {}
  },
  "required": [
    "slug",
    "httpUrl",
    "manifest"
  ],
  "additionalProperties": false
}
```
