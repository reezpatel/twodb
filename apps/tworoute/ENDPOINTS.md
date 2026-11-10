# ENDPOINTS.md — TwoRoute

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Multi-provider LLM gateway: Space-scoped provider connections (encrypted at rest), streaming OpenAI-compatible /completions, model listing, connection smoke-tests, and token-usage logging.

- **Shape**: backend
- **Base path (via Gateway)**: `/apps/tworoute`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-10T05:38:14.822Z_

## Endpoints

### `GET /connections` — listConnections

Lists LLM provider connections visible to the caller's active spaces. API keys are never returned — not even encrypted.

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
      "provider": {
        "type": "string"
      },
      "baseUrl": {
        "type": "string"
      },
      "defaultModel": {
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
      "spaceId",
      "name",
      "provider",
      "baseUrl",
      "defaultModel",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /connections` — createConnection

Registers a new LLM provider connection, scoped to one space. `name` is unique per workspace (that's how the CLI/tests address connections). The API key is encrypted at rest (AES-256-GCM).

- **Auth**: `session-or-apiKey`

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

### `PATCH /connections/:id` — updateConnection

Updates a connection's name/base URL/default model, or rotates its API key (only fields present are changed).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "baseUrl": {
      "type": "string"
    },
    "defaultModel": {
      "type": [
        "string",
        "null"
      ]
    },
    "apiKey": {
      "type": "string"
    }
  },
  "required": [
    "id"
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
    "ok": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `DELETE /connections/:id` — deleteConnection

Deletes a connection. Usage history is kept (it references the connection by id).

- **Auth**: `session-or-apiKey`

**Request**
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

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean",
      "const": true
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `POST /connections/:id/test` — testConnection

Smoke-tests a connection without burning a real completion: lists models when the provider supports it (validating the key in the process), else falls back to a minimal 1-token completion.

- **Auth**: `session-or-apiKey`

**Request**
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

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ok": {
      "type": "boolean"
    },
    "via": {
      "type": "string",
      "enum": [
        "models",
        "completion"
      ]
    },
    "modelCount": {
      "type": "number"
    },
    "upstreamStatus": {
      "type": "number"
    }
  },
  "required": [
    "ok",
    "via"
  ],
  "additionalProperties": false
}
```

### `GET /connections/:id/models` — listModels

Lists the models a connection can serve (OpenAI's GET /models shape). 422 when the provider has no listing API (e.g. Anthropic) — enter a model name manually in that case.

- **Auth**: `session-or-apiKey`

**Request**
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

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "models": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "models"
  ],
  "additionalProperties": false
}
```

### `GET /usage` — getUsage

Token-usage summary per connection+model over the last N days (?days=7, max 90). Only non-streaming completions are recorded — streamed requests stay unmeasured in v1 (the SSE token counts would need interception; deliberately deferred).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "days": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "since": {
      "type": "string"
    },
    "days": {
      "type": "number"
    },
    "rows": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "connection_id": {
            "type": "string"
          },
          "model": {
            "type": "string"
          },
          "calls": {},
          "input_tokens": {},
          "output_tokens": {}
        },
        "required": [
          "connection_id",
          "model",
          "calls",
          "input_tokens",
          "output_tokens"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "since",
    "days",
    "rows"
  ],
  "additionalProperties": false
}
```

### `POST /completions` — completions

OpenAI-compatible chat completions. Pick a connection via `connectionId`, `connectionName` (unique per workspace — handy for CLI/tests), or the first visible in-scope if both are omitted. Non-streaming requests get a plain JSON response and are usage-logged; `stream: true` is a raw pass-through. Any external tool (e.g. Cursor) can point at this with a workspace API key, same as an internal app.

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
    "connectionName": {
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
