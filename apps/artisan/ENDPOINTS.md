# ENDPOINTS.md — Artisan

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Coding agent harness — sessions on runner directories, threads, subagents, skills.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/artisan`
- **Capabilities**: ws
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T03:54:51.315Z_

## Endpoints

### `POST /sessions` — createSession

Creates a session bound to a runner directory (any type; type=directory is the default webapp kind). Optional opening message runs immediately.

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
    "type": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "runner": {
      "type": "string"
    },
    "directory": {
      "type": "string"
    },
    "model": {
      "type": "string"
    },
    "interactive": {
      "type": "boolean"
    },
    "agentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "message": {
      "type": "string"
    }
  },
  "required": [
    "runner",
    "directory"
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
    "type": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "runner": {
      "type": "string"
    },
    "directory": {
      "type": "string"
    },
    "model": {
      "type": "string"
    },
    "interactive": {
      "type": "boolean"
    },
    "spaceId": {
      "type": "string"
    },
    "agentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "parentSessionId": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "type",
    "title",
    "runner",
    "directory",
    "model",
    "interactive",
    "spaceId",
    "agentId",
    "parentSessionId",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `GET /sessions` — listSessions

Sessions, newest first. Defaults to type=directory (webapp list); ?type= picks another, ?all=1 disables the filter.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "type": {
      "type": "string"
    },
    "runner": {
      "type": "string"
    },
    "directory": {
      "type": "string"
    },
    "spaceId": {
      "type": "string"
    },
    "all": {
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
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "type": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "runner": {
        "type": "string"
      },
      "directory": {
        "type": "string"
      },
      "model": {
        "type": "string"
      },
      "interactive": {
        "type": "boolean"
      },
      "spaceId": {
        "type": "string"
      },
      "agentId": {
        "type": [
          "string",
          "null"
        ]
      },
      "parentSessionId": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "type": "string"
      },
      "updatedAt": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "type",
      "title",
      "runner",
      "directory",
      "model",
      "interactive",
      "spaceId",
      "agentId",
      "parentSessionId",
      "createdAt",
      "updatedAt"
    ],
    "additionalProperties": false
  }
}
```

### `GET /sessions/:id` — getSession

Session + flat messages + usage + plan + running flag. Works for any session type.

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
    "id": {
      "type": "string"
    },
    "type": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "runner": {
      "type": "string"
    },
    "directory": {
      "type": "string"
    },
    "model": {
      "type": "string"
    },
    "interactive": {
      "type": "boolean"
    },
    "spaceId": {
      "type": "string"
    },
    "agentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "parentSessionId": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    },
    "plan": {
      "anyOf": [
        {},
        {
          "type": "null"
        }
      ]
    },
    "running": {
      "type": "boolean"
    },
    "usage": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "inputTokens": {
              "type": "number"
            },
            "outputTokens": {
              "type": "number"
            },
            "cachedTokens": {
              "type": "number"
            },
            "calls": {
              "type": "number"
            },
            "costUsd": {
              "type": [
                "number",
                "null"
              ]
            }
          },
          "required": [
            "inputTokens",
            "outputTokens",
            "cachedTokens",
            "calls",
            "costUsd"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "role": {
            "type": "string"
          },
          "content": {
            "type": "string"
          },
          "meta": {},
          "createdAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "role",
          "content",
          "meta",
          "createdAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "id",
    "type",
    "title",
    "runner",
    "directory",
    "model",
    "interactive",
    "spaceId",
    "agentId",
    "parentSessionId",
    "createdAt",
    "updatedAt",
    "plan",
    "running",
    "usage",
    "messages"
  ],
  "additionalProperties": false
}
```

### `PATCH /sessions/:id` — updateSession

Renames and/or switches the session's model.

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
    "title": {
      "type": "string"
    },
    "model": {
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
    "id": {
      "type": "string"
    },
    "type": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "runner": {
      "type": "string"
    },
    "directory": {
      "type": "string"
    },
    "model": {
      "type": "string"
    },
    "interactive": {
      "type": "boolean"
    },
    "spaceId": {
      "type": "string"
    },
    "agentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "parentSessionId": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "type",
    "title",
    "runner",
    "directory",
    "model",
    "interactive",
    "spaceId",
    "agentId",
    "parentSessionId",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `POST /sessions/:id/messages` — sendMessage

Sends a user message and starts a run (same as the WS send frame). Stream frames over the workspace WS.

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
    "message": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "message"
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
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `POST /sessions/:id/new` — newThread

/new — closes the current thread and opens a fresh one; clears the plan.

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
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `POST /sessions/:id/compact` — compactSession

/compact — summarizes the conversation into the thread summary and starts a new thread.

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
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "ok",
    "summary"
  ],
  "additionalProperties": false
}
```

### `POST /sessions/:id/abort` — abortSession

Aborts a running session loop.

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
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `GET /ws` — workspaceWs

One WS per workspace. Client frames: join/leave {sessionId}, send {sessionId,text}, answer/cancel {sessionId,askId}. Server frames all carry sessionId: joined, message, run_start, round_start, thinking_delta, delta, message_done, tool_start/output/result, ask_user, ask_resolved, status, plan, usage, compaction_done, session_renamed, error, done.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

### `GET /directories` — listDirectories

Distinct runner+directory+space combos the workspace has sessions on.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "runner": {
        "type": "string"
      },
      "directory": {
        "type": "string"
      },
      "spaceId": {
        "type": "string"
      },
      "sessions": {
        "type": "number"
      }
    },
    "required": [
      "runner",
      "directory",
      "spaceId",
      "sessions"
    ],
    "additionalProperties": false
  }
}
```

### `POST /agents` — createAgent

Creates a custom agent (sub_agent | persona | collaborator | any custom type).

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
    "type": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "instruction": {
      "type": "string"
    },
    "model": {
      "type": [
        "string",
        "null"
      ]
    },
    "tools": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "skillTags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "runner": {
      "type": [
        "string",
        "null"
      ]
    },
    "directory": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "type",
    "name",
    "instruction"
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
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `GET /agents` — listAgents

Agents in a space (directory agents included — they are auto-created per runner+directory).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "spaceId": {
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
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "type": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "model": {
        "type": [
          "string",
          "null"
        ]
      },
      "tools": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "skillTags": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "tags": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "runner": {
        "type": [
          "string",
          "null"
        ]
      },
      "directory": {
        "type": [
          "string",
          "null"
        ]
      },
      "spaceId": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "type",
      "name",
      "description",
      "model",
      "tools",
      "skillTags",
      "tags",
      "runner",
      "directory",
      "spaceId"
    ],
    "additionalProperties": false
  }
}
```

### `PATCH /agents/:id` — updateAgent

Updates any agent field (instruction, model, tools allowlist, tags, pinned dir).

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
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `DELETE /agents/:id` — deleteAgent

Deletes an agent.

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
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `POST /skills` — createSkill

Creates a space-scoped skill with optional directory pin and tags.

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
    "directory": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "name",
    "description",
    "content"
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
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `GET /skills` — listSkills

Skills in a space.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "spaceId": {
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
      "description": {
        "type": "string"
      },
      "directory": {
        "type": [
          "string",
          "null"
        ]
      },
      "tags": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "spaceId": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "description",
      "directory",
      "tags",
      "spaceId"
    ],
    "additionalProperties": false
  }
}
```

### `PATCH /skills/:id` — updateSkill

Updates a skill.

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
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `DELETE /skills/:id` — deleteSkill

Deletes a skill.

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
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `GET /models` — listModels

Proxied TwoRoute /v1/models — the model picker source.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

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
      "connection": {
        "type": "string"
      },
      "contextWindow": {
        "type": [
          "number",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "name",
      "provider",
      "connection",
      "contextWindow"
    ],
    "additionalProperties": false
  }
}
```

### `GET /runners` — listRunners

Proxied Dispatch runners, online only.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "status": {
        "type": "string"
      },
      "kind": {
        "type": "string"
      }
    },
    "required": [
      "name",
      "status",
      "kind"
    ],
    "additionalProperties": false
  }
}
```
