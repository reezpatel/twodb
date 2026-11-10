# ENDPOINTS.md — TwoRoute

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Multi-provider LLM gateway: 24 provider kinds (OAuth for Claude Code & Codex included), space-scoped connections with secrets encrypted at rest, model caching enriched from models.dev, provider quota tracking, streaming OpenAI-compatible /completions, and token-usage logging.

- **Shape**: backend
- **Base path (via Gateway)**: `/apps/tworoute`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-10T19:18:27.391Z_

## Endpoints

### `GET /providers` — listProviders

The provider catalog: 24 providers with their form fields (which are secret/optional), auth style, wire protocol, default base URL, and static fallback model lists. The UI builds its add-connection form entirely from this.

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
      "label": {
        "type": "string"
      },
      "fields": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "key": {
              "type": "string"
            },
            "label": {
              "type": "string"
            },
            "secret": {
              "type": "boolean"
            },
            "optional": {
              "type": "boolean"
            },
            "placeholder": {
              "type": "string"
            }
          },
          "required": [
            "key",
            "label"
          ],
          "additionalProperties": false
        }
      },
      "api": {
        "type": "string",
        "enum": [
          "anthropic",
          "openai",
          "responses"
        ]
      },
      "auth": {
        "type": "string",
        "enum": [
          "x-api-key",
          "bearer",
          "claude-oauth",
          "codex-oauth"
        ]
      },
      "authKey": {
        "type": "string"
      },
      "defaultBaseUrl": {
        "type": "string"
      },
      "models": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "id",
      "label",
      "fields",
      "api",
      "auth",
      "models"
    ],
    "additionalProperties": false
  }
}
```

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

Registers a new LLM provider connection, scoped to one space. `name` is unique per workspace (that's how the CLI/tests address connections). Secrets (api key, OAuth tokens, extra config) are encrypted at rest (AES-256-GCM). On create the model cache is seeded right away (static fallback if the provider's listing API fails).

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
      "type": "string"
    },
    "baseUrl": {
      "type": "string"
    },
    "apiKey": {
      "type": "string"
    },
    "defaultModel": {
      "type": "string"
    },
    "config": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    }
  },
  "required": [
    "spaceId",
    "name",
    "provider"
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

Updates a connection — rename, move space, change base URL/default model, rotate the API key, or replace its config (OAuth tokens, org, accountId…). Only fields present are changed.

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
    "spaceId": {
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
    },
    "config": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
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

Deletes a connection, its cached models, and its quota snapshots. Usage history is kept (soft reference by id).

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

Smoke-tests a connection without burning a real completion: lists models when the provider supports it (validating the key in the process), else falls back to a minimal 1-token completion. OAuth connections get their access token refreshed first.

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
      "type": [
        "number",
        "null"
      ]
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

Lists a connection's cached models — refreshed from the provider when possible, enriched with models.dev metadata (context window, costs, modalities, thinking levels), falling back to the provider's static list. POST refresh-models re-populates the cache.

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
        "type": "object",
        "properties": {
          "modelId": {
            "type": "string"
          },
          "displayName": {
            "type": [
              "string",
              "null"
            ]
          },
          "contextWindow": {
            "type": [
              "number",
              "null"
            ]
          },
          "thinking": {
            "type": "boolean"
          },
          "input": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "thinkingLevel": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "temperature": {
            "type": "boolean"
          },
          "limitContext": {
            "type": [
              "number",
              "null"
            ]
          },
          "limitInput": {
            "type": [
              "number",
              "null"
            ]
          },
          "limitOutput": {
            "type": [
              "number",
              "null"
            ]
          },
          "costInput": {
            "type": [
              "number",
              "null"
            ]
          },
          "costOutput": {
            "type": [
              "number",
              "null"
            ]
          },
          "costCacheRead": {
            "type": [
              "number",
              "null"
            ]
          },
          "output": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "modelId",
          "displayName",
          "contextWindow",
          "thinking",
          "input",
          "thinkingLevel",
          "temperature",
          "limitContext",
          "limitInput",
          "limitOutput",
          "costInput",
          "costOutput",
          "costCacheRead",
          "output"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "models"
  ],
  "additionalProperties": false
}
```

### `POST /connections/:id/refresh-models` — refreshModels

Re-fetches a connection's model list from the provider (or its static catalog when there's no listing API), enriches with models.dev metadata, and replaces the cache. Returns count + any warnings.

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
    "count": {
      "type": "number"
    },
    "warning": {
      "type": "string"
    }
  },
  "required": [
    "count"
  ],
  "additionalProperties": false
}
```

### `GET /quotas` — listQuotas

All quota snapshots for the workspace, joined per connection — provider usage windows (5h/weekly percentages, credits, token counts) as last captured.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "quotas": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "connectionId": {
            "type": "string"
          },
          "quotaType": {
            "type": "string"
          },
          "groupName": {
            "type": "string"
          },
          "unit": {
            "type": "string"
          },
          "quotaTotal": {
            "type": [
              "number",
              "null"
            ]
          },
          "quotaUsed": {
            "type": "number"
          },
          "capturedAt": {
            "type": "string"
          },
          "resetAt": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "connectionId",
          "quotaType",
          "groupName",
          "unit",
          "quotaTotal",
          "quotaUsed",
          "capturedAt",
          "resetAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "quotas"
  ],
  "additionalProperties": false
}
```

### `GET /connections/:id/quotas` — listConnectionQuotas

One connection's quota snapshots, ordered by type.

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
    "quotas": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "connectionId": {
            "type": "string"
          },
          "quotaType": {
            "type": "string"
          },
          "groupName": {
            "type": "string"
          },
          "unit": {
            "type": "string"
          },
          "quotaTotal": {
            "type": [
              "number",
              "null"
            ]
          },
          "quotaUsed": {
            "type": "number"
          },
          "capturedAt": {
            "type": "string"
          },
          "resetAt": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "connectionId",
          "quotaType",
          "groupName",
          "unit",
          "quotaTotal",
          "quotaUsed",
          "capturedAt",
          "resetAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "quotas"
  ],
  "additionalProperties": false
}
```

### `POST /connections/:id/refresh-quotas` — refreshQuotas

Fetches fresh quota snapshots from the provider's usage API (claude-code, codex, zai, kimi, ollama-cloud, minimax, kilo-code, cline have collectors) and replaces the cached windows.

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
    "quotas": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "connectionId": {
            "type": "string"
          },
          "quotaType": {
            "type": "string"
          },
          "groupName": {
            "type": "string"
          },
          "unit": {
            "type": "string"
          },
          "quotaTotal": {
            "type": [
              "number",
              "null"
            ]
          },
          "quotaUsed": {
            "type": "number"
          },
          "capturedAt": {
            "type": "string"
          },
          "resetAt": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "connectionId",
          "quotaType",
          "groupName",
          "unit",
          "quotaTotal",
          "quotaUsed",
          "capturedAt",
          "resetAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "quotas"
  ],
  "additionalProperties": false
}
```

### `GET /connections/:id/usage` — getConnectionUsage

Per-connection usage totals: request count, token sums, last-used time (from the usage log).

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
    "requests": {
      "type": "number"
    },
    "inputTokens": {
      "type": "number"
    },
    "outputTokens": {
      "type": "number"
    },
    "lastUsedAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "requests",
    "inputTokens",
    "outputTokens",
    "lastUsedAt"
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

### `GET /analytics/summary` — analyticsSummary

24h usage summary (default ?days=1) per (connection, model): calls with completed/failed split, input/output token sums, and avg/p95 latency — one usage_log query feeds every dashboard widget. Cost is derived client-side from cached model prices. Optional ?connectionId= scopes to one connection.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "days": {
      "type": "string"
    },
    "connectionId": {
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
          "connectionId": {
            "type": "string"
          },
          "model": {
            "type": "string"
          },
          "calls": {
            "type": "number"
          },
          "completed": {
            "type": "number"
          },
          "failed": {
            "type": "number"
          },
          "inputTokens": {
            "type": "number"
          },
          "outputTokens": {
            "type": "number"
          },
          "avgLatencyMs": {
            "type": [
              "number",
              "null"
            ]
          },
          "p95LatencyMs": {
            "type": [
              "number",
              "null"
            ]
          }
        },
        "required": [
          "connectionId",
          "model",
          "calls",
          "completed",
          "failed",
          "inputTokens",
          "outputTokens",
          "avgLatencyMs",
          "p95LatencyMs"
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

### `GET /analytics/calls` — analyticsCalls

Call analytics as daily buckets (date_trunc day) per connection, up to 365 days back — feeds the dashboard's Calls widget yearly view, with completed/failed split per day. Optional ?connectionId= scopes to one connection. Days without calls return no bucket — clients fill the gaps.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "days": {
      "type": "string"
    },
    "connectionId": {
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
    "buckets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "connectionId": {
            "type": "string"
          },
          "day": {
            "type": "string"
          },
          "calls": {
            "type": "number"
          },
          "completed": {
            "type": "number"
          },
          "failed": {
            "type": "number"
          }
        },
        "required": [
          "connectionId",
          "day",
          "calls",
          "completed",
          "failed"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "since",
    "days",
    "buckets"
  ],
  "additionalProperties": false
}
```

### `GET /analytics/tools` — analyticsTools

Tool invocations grouped per tool name over the window (default 24h): calls + completed/failed split. Rows come from assistant-chosen tool_calls parsed out of completion responses, and direct POST /tools/invoke logs.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "days": {
      "type": "string"
    },
    "connectionId": {
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
    "tools": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "calls": {
            "type": "number"
          },
          "completed": {
            "type": "number"
          },
          "failed": {
            "type": "number"
          }
        },
        "required": [
          "name",
          "calls",
          "completed",
          "failed"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "since",
    "days",
    "tools"
  ],
  "additionalProperties": false
}
```

### `POST /tools/invoke` — toolInvoke

Logs one tool invocation against a connection (the app executes the tool itself; this records the fact). Sets the usage row's tool_name so /analytics/tools picks it up.

- **Auth**: `session-or-apiKey`

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
    "tool": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "ok",
        "error"
      ]
    },
    "latencyMs": {
      "type": "number"
    }
  },
  "required": [
    "tool"
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

### `POST /oauth/claude-code/start` — oauthClaudeCodeStart

Starts the Claude Code OAuth PKCE flow: spins up a one-shot local callback listener and returns the browser authorize URL. Poll with /poll until done; if the local callback is unreachable (firewalled browser), /complete accepts the pasted callback URL.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "url": {
      "type": "string"
    },
    "state": {
      "type": "string"
    }
  },
  "required": [
    "url",
    "state"
  ],
  "additionalProperties": false
}
```

### `POST /oauth/claude-code/poll` — oauthClaudeCodePoll

Polls an OAuth flow started with /start. pending → done (tokens) | error. Once done, save the refresh/access tokens on the connection's config.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "state": {
      "type": "string"
    }
  },
  "required": [
    "state"
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
    "status": {
      "type": "string",
      "enum": [
        "pending",
        "done",
        "error",
        "unknown"
      ]
    }
  },
  "required": [
    "status"
  ],
  "additionalProperties": {}
}
```

### `POST /oauth/claude-code/complete` — oauthClaudeCodeComplete

Manual OAuth completion for firewalled local callbacks: accepts the pasted callback URL (or "code state" pair) instead of the local listener.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "input": {
      "type": "string"
    }
  },
  "required": [
    "input"
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
    "status": {
      "type": "string"
    }
  },
  "required": [
    "status"
  ],
  "additionalProperties": {}
}
```

### `POST /oauth/codex/start` — oauthCodexStart

Starts the ChatGPT/Codex OAuth PKCE flow: spins up a one-shot local callback listener and returns the browser authorize URL. Poll with /poll until done; if the local callback is unreachable (firewalled browser), /complete accepts the pasted callback URL.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "url": {
      "type": "string"
    },
    "state": {
      "type": "string"
    }
  },
  "required": [
    "url",
    "state"
  ],
  "additionalProperties": false
}
```

### `POST /oauth/codex/poll` — oauthCodexPoll

Polls an OAuth flow started with /start. pending → done (tokens) | error. Once done, save the refresh/access tokens on the connection's config.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "state": {
      "type": "string"
    }
  },
  "required": [
    "state"
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
    "status": {
      "type": "string",
      "enum": [
        "pending",
        "done",
        "error",
        "unknown"
      ]
    }
  },
  "required": [
    "status"
  ],
  "additionalProperties": {}
}
```

### `POST /oauth/codex/complete` — oauthCodexComplete

Manual OAuth completion for firewalled local callbacks: accepts the pasted callback URL (or "code state" pair) instead of the local listener.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "input": {
      "type": "string"
    }
  },
  "required": [
    "input"
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
    "status": {
      "type": "string"
    }
  },
  "required": [
    "status"
  ],
  "additionalProperties": {}
}
```

### `POST /completions` — completions

OpenAI-compatible chat completions (anthropic/responses wires translated per provider). Pick a connection via `connectionId`, `connectionName` (unique per workspace — handy for CLI/tests), or the first visible in-scope if both are omitted. Non-streaming requests get a plain JSON response and are usage-logged; `stream: true` is a raw pass-through. OAuth-backed providers (claude-code, codex) get their access token refreshed automatically when stale. Any external tool (e.g. Cursor) can point at this with a workspace API key, same as an internal app.

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

### `POST /audio/transcriptions` — transcriptions

OpenAI-compatible audio transcription (Whisper & friends). The multipart form-data body passes through untouched to the picked connection's base_url — any provider wire is allowed; an upstream without a transcription API returns its own error. Pick the connection via `?connectionId=` or `?connectionName=` query params (first visible in-scope otherwise). Also served at /v1/audio/transcriptions for stock OpenAI SDK clients.

- **Auth**: `session-or-apiKey`

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
    "text": {
      "type": "string"
    }
  },
  "additionalProperties": {}
}
```

### `POST /v1/chat/completions` — openaiCompatChat

OpenAI path-shape alias of POST /completions — same handler. Point any stock OpenAI SDK client (openai npm pkg, Cursor, Continue…) at {gateway}/apps/tworoute/v1 with a TwoDB workspace API key as the apiKey; the gateway accepts workspace keys in the Authorization: Bearer slot too. A model id of the form "<connection-name>/<model-id>" (as returned by GET /v1/models) targets that connection specifically; a bare model name uses the first visible connection (or explicit connectionId/connectionName).

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

### `GET /v1/models` — openaiCompatModels

OpenAI list-shape model catalog aggregated across ALL visible connections. Each id is "<connection-name>/<model-id>" (e.g. "kilo/anthropic/claude-opus-4.8", "openai/gpt-5.2") — use that id as the model in /v1/chat/completions to target the connection. Beyond the standard fields (id, object, created, owned_by) each entry carries connection_name, provider, display_name, context_window, thinking, input/output modalities, temperature support, max input/output tokens, and per-million costs (cached from the provider, enriched via models.dev).

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "object": {
      "type": "string",
      "const": "list"
    },
    "data": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "object": {
            "type": "string",
            "const": "model"
          },
          "created": {
            "type": "number"
          },
          "owned_by": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "object",
          "created",
          "owned_by"
        ],
        "additionalProperties": {}
      }
    }
  },
  "required": [
    "object",
    "data"
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
