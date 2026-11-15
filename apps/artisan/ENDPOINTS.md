# ENDPOINTS.md — Artisan

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Coding agent harness — sessions on runner directories, threads, subagents, skills.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/artisan/api`
- **Capabilities**: ws
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-15T19:04:19.209Z_

## Endpoints

### `POST /_svc/inbox` — serviceInbox

App-to-app message inbox (core-async relay). Authenticated by a control-plane-signed service token whose scope names the message type; the workspace comes from the token, never the body. Accepts artisan.collab.run | cancel | rollback, dedupes on dedupeKey and enqueues into Artisan's own queue.

- **Auth**: `public`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "type": {
      "type": "string"
    },
    "payload": {},
    "dedupeKey": {
      "type": "string"
    }
  },
  "required": [
    "type",
    "payload",
    "dedupeKey"
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
    },
    "agentId": {
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

### `GET /sessions/:id/canvases` — listCanvases

Lists the session's Canvas documents with content fetched from Paintress. Directory-agent canvases are session-scoped; configured-agent canvases are shared across that agent's sessions.

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
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "type": {
        "type": "string"
      },
      "resourceId": {
        "type": "string"
      },
      "markdown": {
        "type": "string"
      },
      "version": {
        "type": "number"
      },
      "updatedAt": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "title",
      "type",
      "resourceId",
      "markdown",
      "version",
      "updatedAt"
    ],
    "additionalProperties": false
  }
}
```

### `GET /sessions/:id/inspect/:inspectId` — getInspectRound

Inspector: the exact request (system prompt, history, tool schemas) sent for one round. Kept 3 days, then 404 { error: 'expired' }.

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
    "inspectId": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "inspectId"
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
    "round": {
      "type": "number"
    },
    "createdAt": {
      "type": "string"
    },
    "tools": {},
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "role": {
            "type": "string"
          },
          "content": {
            "type": [
              "string",
              "null"
            ]
          },
          "toolCallId": {
            "type": "string"
          },
          "toolCalls": {}
        },
        "required": [
          "role",
          "content"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "id",
    "round",
    "createdAt",
    "tools",
    "messages"
  ],
  "additionalProperties": false
}
```

### `GET /microvms` — listMicrovms

Dispatch microvms usable as a session runner (address them as `microvm:<identifier>`).

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
      "identifier": {
        "type": "string"
      },
      "runnerId": {
        "type": "string"
      },
      "runnerName": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": "string"
      },
      "bootCount": {
        "type": "number"
      },
      "lastActiveAt": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "identifier",
      "runnerId",
      "runnerName",
      "status",
      "bootCount",
      "lastActiveAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /microvms` — createMicrovm

Boots a new microvm through dispatch. Optional name becomes the identifier.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "memMb": {
      "type": "number"
    },
    "vcpu": {
      "type": "number"
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
    "id": {
      "type": "string"
    },
    "identifier": {
      "type": "string"
    },
    "runnerId": {
      "type": "string"
    },
    "status": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "identifier",
    "runnerId",
    "status"
  ],
  "additionalProperties": false
}
```

### `GET /runners/:runner/fs` — listRunnerDir

Lists a directory on a runner or microvm (directory picker). `path` may start with ~.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runner": {
      "type": "string"
    },
    "path": {
      "type": "string"
    }
  },
  "required": [
    "runner"
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
    "path": {
      "type": "string"
    },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "dir": {
            "type": "boolean"
          }
        },
        "required": [
          "name",
          "dir"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "path",
    "entries"
  ],
  "additionalProperties": false
}
```

### `POST /runners/:runner/fs/mkdir` — makeRunnerDir

mkdir -p an absolute path on a runner or microvm.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runner": {
      "type": "string"
    },
    "path": {
      "type": "string"
    }
  },
  "required": [
    "runner",
    "path"
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
    "path": {
      "type": "string"
    }
  },
  "required": [
    "ok",
    "path"
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

One WS per workspace. Client frames: join/leave {sessionId}, send {sessionId,text}, answer/cancel {sessionId,askId}. Server frames all carry sessionId: joined, message, run_start, round_start, thinking_delta, delta, message_done, tool_start/output/result, ask_user, ask_resolved, status, plan, canvas, usage, compaction_done, session_renamed, error, done.

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
    "spaceIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
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
    "name"
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

### `GET /agents/:id` — getAgent

One agent including its instruction (system prompt).

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
    },
    "spaceIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "id",
    "type",
    "name",
    "description",
    "instruction",
    "model",
    "tools",
    "runner",
    "directory",
    "spaceId",
    "spaceIds"
  ],
  "additionalProperties": false
}
```

### `GET /tools` — listTools

The tools an agent can be allowed to use (name + description).

- **Auth**: `session-or-apiKey`

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
      "description": {
        "type": "string"
      }
    },
    "required": [
      "name",
      "description"
    ],
    "additionalProperties": false
  }
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

Creates a skill. `scope` = one availability mode: global | agents | spaces | types, each (except global) either `all` or a list of ids (agent ids, space ids, or agent types).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "name",
    "scope"
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
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "content": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "name",
    "description",
    "scope"
  ],
  "additionalProperties": false
}
```

### `GET /skills` — listSkills

All skills in the workspace with their availability scope (?content=1 includes the content).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "content": {
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
      "scope": {
        "type": "object",
        "properties": {
          "mode": {
            "type": "string",
            "enum": [
              "global",
              "agents",
              "spaces",
              "types"
            ]
          },
          "all": {
            "type": "boolean"
          },
          "ids": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "mode",
          "all",
          "ids"
        ],
        "additionalProperties": false
      },
      "content": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "description",
      "scope"
    ],
    "additionalProperties": false
  }
}
```

### `GET /skills/:id` — getSkill

One skill including its content.

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
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "content": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "name",
    "description",
    "scope"
  ],
  "additionalProperties": false
}
```

### `PATCH /skills/:id` — updateSkill

Updates a skill's name, description, content or availability scope.

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
    "description": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
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
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "content": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "name",
    "description",
    "scope"
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

### `GET /settings/global-instruction` — getGlobalInstruction

The workspace's global instruction — base rules added to every agent's system prompt.

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
  "properties": {
    "content": {
      "type": "string"
    },
    "updatedAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "content",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PUT /settings/global-instruction` — setGlobalInstruction

Sets the global instruction (max 20,000 characters; empty clears it). Applies from each agent's next run.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "content": {
      "type": "string"
    }
  },
  "required": [
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
    "content": {
      "type": "string"
    },
    "updatedAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "content",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `GET /mcp` — listMcpServers

MCP server configs (remote http/sse). Config only — not yet offered to agents.

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
      "url": {
        "type": "string"
      },
      "transport": {
        "type": "string",
        "enum": [
          "auto",
          "http",
          "sse"
        ]
      },
      "headers": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {
          "type": "string"
        }
      },
      "enabled": {
        "type": "boolean"
      },
      "scope": {
        "type": "object",
        "properties": {
          "mode": {
            "type": "string",
            "enum": [
              "global",
              "agents",
              "spaces",
              "directories",
              "types"
            ]
          },
          "all": {
            "type": "boolean"
          },
          "ids": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "mode",
          "all",
          "ids"
        ],
        "additionalProperties": false
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
      "name",
      "url",
      "transport",
      "headers",
      "enabled",
      "scope",
      "createdAt",
      "updatedAt"
    ],
    "additionalProperties": false
  }
}
```

### `GET /mcp/:id` — getMcpServer

One MCP server config.

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
    "name": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "transport": {
      "type": "string",
      "enum": [
        "auto",
        "http",
        "sse"
      ]
    },
    "headers": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "directories",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
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
    "name",
    "url",
    "transport",
    "headers",
    "enabled",
    "scope",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `POST /mcp` — createMcpServer

Registers an MCP server. Name is unique and prefixes tool names (mcp__<name>__<tool>); header values may use <ENV_NAME> placeholders. Availability: global, agents, spaces, directories or agent types.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "transport": {
      "type": "string",
      "enum": [
        "auto",
        "http",
        "sse"
      ]
    },
    "headers": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "directories",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "name",
    "url",
    "scope"
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
    "name": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "transport": {
      "type": "string",
      "enum": [
        "auto",
        "http",
        "sse"
      ]
    },
    "headers": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "directories",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
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
    "name",
    "url",
    "transport",
    "headers",
    "enabled",
    "scope",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /mcp/:id` — updateMcpServer

Updates an MCP server's name, url, transport, headers, enabled flag or availability.

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
    "url": {
      "type": "string"
    },
    "transport": {
      "type": "string",
      "enum": [
        "auto",
        "http",
        "sse"
      ]
    },
    "headers": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "directories",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
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
    "name": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "transport": {
      "type": "string",
      "enum": [
        "auto",
        "http",
        "sse"
      ]
    },
    "headers": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "directories",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
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
    "name",
    "url",
    "transport",
    "headers",
    "enabled",
    "scope",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /mcp/:id` — deleteMcpServer

Deletes an MCP server config.

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

### `POST /mcp/import/preview` — previewMcpImport

Parses an mcpServers JSON paste (VS Code / Claude Desktop / Cursor) without saving. stdio entries are skipped.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "json": {
      "type": "string"
    }
  },
  "required": [
    "json"
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
    "drafts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "url": {
            "type": "string"
          },
          "transport": {
            "type": "string",
            "enum": [
              "auto",
              "http",
              "sse"
            ]
          },
          "headers": {
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
          "name",
          "url",
          "transport",
          "headers"
        ],
        "additionalProperties": false
      }
    },
    "skipped": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          }
        },
        "required": [
          "name",
          "reason"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "drafts",
    "skipped"
  ],
  "additionalProperties": false
}
```

### `POST /mcp/import` — importMcpServers

Creates one MCP server per entry of an mcpServers JSON paste, all with the given availability. Existing names are reported as conflicts.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "json": {
      "type": "string"
    },
    "scope": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "global",
            "agents",
            "spaces",
            "directories",
            "types"
          ]
        },
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "mode",
        "all",
        "ids"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "json",
    "scope"
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
    "created": {
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
          "url": {
            "type": "string"
          },
          "transport": {
            "type": "string",
            "enum": [
              "auto",
              "http",
              "sse"
            ]
          },
          "headers": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "string"
            }
          },
          "enabled": {
            "type": "boolean"
          },
          "scope": {
            "type": "object",
            "properties": {
              "mode": {
                "type": "string",
                "enum": [
                  "global",
                  "agents",
                  "spaces",
                  "directories",
                  "types"
                ]
              },
              "all": {
                "type": "boolean"
              },
              "ids": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "mode",
              "all",
              "ids"
            ],
            "additionalProperties": false
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
          "name",
          "url",
          "transport",
          "headers",
          "enabled",
          "scope",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "conflicts": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "skipped": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          }
        },
        "required": [
          "name",
          "reason"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "created",
    "conflicts",
    "skipped"
  ],
  "additionalProperties": false
}
```

### `GET /memories` — listMemories

Memories. With sessionId: what that session's agent sees (organization + directory + own + session; sub-agents inherit their caller's). Without: every memory in the workspace.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "sessionId": {
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
      "level": {
        "type": "string",
        "enum": [
          "organization",
          "code_directory",
          "self",
          "session"
        ]
      },
      "title": {
        "type": "string"
      },
      "content": {
        "type": "string"
      },
      "directoryId": {
        "type": [
          "string",
          "null"
        ]
      },
      "agentId": {
        "type": [
          "string",
          "null"
        ]
      },
      "sessionId": {
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
      "level",
      "title",
      "content",
      "directoryId",
      "agentId",
      "sessionId",
      "createdAt",
      "updatedAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /memories` — createMemory

Creates a memory at a level. code_directory needs directoryId, self needs agentId (persona/collaborator), session needs sessionId. Titles are unique per level and owner.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "level": {
      "type": "string",
      "enum": [
        "organization",
        "code_directory",
        "self",
        "session"
      ]
    },
    "title": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "directoryId": {
      "type": "string"
    },
    "agentId": {
      "type": "string"
    },
    "sessionId": {
      "type": "string"
    }
  },
  "required": [
    "title",
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
    "id": {
      "type": "string"
    },
    "level": {
      "type": "string",
      "enum": [
        "organization",
        "code_directory",
        "self",
        "session"
      ]
    },
    "title": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "directoryId": {
      "type": [
        "string",
        "null"
      ]
    },
    "agentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "sessionId": {
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
    "level",
    "title",
    "content",
    "directoryId",
    "agentId",
    "sessionId",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /memories/:id` — updateMemory

Renames a memory and/or replaces its content.

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
    "content": {
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
    "level": {
      "type": "string",
      "enum": [
        "organization",
        "code_directory",
        "self",
        "session"
      ]
    },
    "title": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "directoryId": {
      "type": [
        "string",
        "null"
      ]
    },
    "agentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "sessionId": {
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
    "level",
    "title",
    "content",
    "directoryId",
    "agentId",
    "sessionId",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /memories/:id` — deleteMemory

Deletes a memory.

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
