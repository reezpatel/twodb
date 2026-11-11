# ENDPOINTS.md — Dispatch

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Runner manager: remote command exec (one-shot + streamed), long-running jobs with tail/SSE follow, and ephemeral Firecracker microvms with a persistent /app that survives shutdown (zipped to S3 on shutdown, restored on resume, archived after a configurable inactivity window). Runners connect over a long-lived WebSocket and carry a friendly, workspace-unique identifier.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/dispatch`
- **Capabilities**: exec
- **Core deps**: core-data, core-platform

_Generated: 2026-11-11T11:06:26.793Z_

## Endpoints

### `POST /runners` — createRunner

Creates a runner entry and returns its key (twodbrun_...) exactly once — the runner presents this key on its WebSocket connect. Optionally give a friendly name; one is generated otherwise.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 40
    },
    "kind": {
      "type": "string",
      "enum": [
        "host",
        "microvm-host"
      ]
    },
    "meta": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
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
    "runner": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "kind": {
          "type": "string",
          "enum": [
            "host",
            "microvm-host"
          ]
        },
        "status": {
          "type": "string",
          "enum": [
            "online",
            "offline"
          ]
        },
        "meta": {
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {}
        },
        "lastSeenAt": {
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
        "name",
        "kind",
        "status",
        "meta",
        "lastSeenAt",
        "createdAt"
      ],
      "additionalProperties": false
    },
    "key": {
      "type": "string"
    }
  },
  "required": [
    "runner",
    "key"
  ],
  "additionalProperties": false
}
```

### `GET /runners` — listRunners

All runners in the workspace with online status and host metadata.

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
      "name": {
        "type": "string"
      },
      "kind": {
        "type": "string",
        "enum": [
          "host",
          "microvm-host"
        ]
      },
      "status": {
        "type": "string",
        "enum": [
          "online",
          "offline"
        ]
      },
      "meta": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      },
      "lastSeenAt": {
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
      "name",
      "kind",
      "status",
      "meta",
      "lastSeenAt",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `DELETE /runners/:name` — deleteRunner

Removes a runner and revokes its key (its WS is dropped if online).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    }
  },
  "required": [
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

### `POST /enroll-tokens` — createEnrollToken

Creates a shared enrollment token (twodbenroll_..., shown exactly once). Any number of machines can present it via two-runner --enroll; each gets its own runner identity + per-runner key. Optional expiresInDays.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 40
    },
    "expiresInDays": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 365
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
    "token": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "enrollCount": {
          "type": "number"
        },
        "lastUsedAt": {
          "type": [
            "string",
            "null"
          ]
        },
        "expiresAt": {
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
        "name",
        "enrollCount",
        "lastUsedAt",
        "expiresAt",
        "createdAt"
      ],
      "additionalProperties": false
    },
    "key": {
      "type": "string"
    }
  },
  "required": [
    "token",
    "key"
  ],
  "additionalProperties": false
}
```

### `GET /enroll-tokens` — listEnrollTokens

Enrollment tokens with usage counts (never the token values).

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
      "name": {
        "type": "string"
      },
      "enrollCount": {
        "type": "number"
      },
      "lastUsedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "expiresAt": {
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
      "name",
      "enrollCount",
      "lastUsedAt",
      "expiresAt",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `DELETE /enroll-tokens/:id` — deleteEnrollToken

Revokes an enrollment token (no new machines can join with it).

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

### `POST /exec` — execCommand

Runs a one-shot command on a runner and returns the collected stdout/stderr + exit code. The whole output is buffered on the runner before it answers.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runnerId": {
      "type": "string"
    },
    "resourceId": {
      "type": "string"
    },
    "command": {
      "type": "string"
    },
    "cwd": {
      "type": "string"
    },
    "env": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "timeoutMs": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 600000
    }
  },
  "required": [
    "runnerId",
    "command"
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
    "exitCode": {
      "type": "number"
    },
    "stdout": {
      "type": "string"
    },
    "stderr": {
      "type": "string"
    },
    "durationMs": {
      "type": "number"
    }
  },
  "required": [
    "exitCode",
    "stdout",
    "stderr",
    "durationMs"
  ],
  "additionalProperties": false
}
```

### `POST /calls` — callCommand

Starts a command on a runner and returns a callId immediately; subscribe to GET /calls/:callId/stream (SSE) for live output chunks and the done frame. Chosen when output is large or long-lived; execCommand otherwise.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runnerId": {
      "type": "string"
    },
    "resourceId": {
      "type": "string"
    },
    "command": {
      "type": "string"
    },
    "cwd": {
      "type": "string"
    },
    "env": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "timeoutMs": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 600000
    }
  },
  "required": [
    "runnerId",
    "command"
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
    "callId": {
      "type": "string"
    },
    "runnerName": {
      "type": "string"
    }
  },
  "required": [
    "callId",
    "runnerName"
  ],
  "additionalProperties": false
}
```

### `GET /calls/:callId/stream` — streamCall

SSE stream of a call's output: one `data:` frame per output chunk ({stream:'stdout'|'stderr', chunk}) and a final {done, exitCode}. Replays chunks recorded before the subscribe (kept in memory) so slow joiners see the full transcript.

- **Auth**: `session-or-apiKey`
- **Streaming**: yes (chunked/SSE response)

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "callId": {
      "type": "string"
    }
  },
  "required": [
    "callId"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "string"
}
```

### `POST /jobs` — createJob

Starts a long-running job (detached) on a runner. Returns immediately with the job id; logs stream to GET /jobs/:id/tail.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runnerId": {
      "type": "string"
    },
    "resourceId": {
      "type": "string"
    },
    "command": {
      "type": "string"
    },
    "cwd": {
      "type": "string"
    },
    "env": {
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
    "runnerId",
    "command"
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
    "runnerId": {
      "type": "string"
    },
    "runnerName": {
      "type": [
        "string",
        "null"
      ]
    },
    "resourceId": {
      "type": [
        "string",
        "null"
      ]
    },
    "command": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "running",
        "completed",
        "failed",
        "terminated"
      ]
    },
    "exitCode": {
      "type": [
        "number",
        "null"
      ]
    },
    "startedAt": {
      "type": "string"
    },
    "endedAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "id",
    "runnerId",
    "runnerName",
    "resourceId",
    "command",
    "status",
    "exitCode",
    "startedAt",
    "endedAt"
  ],
  "additionalProperties": false
}
```

### `GET /jobs` — listJobs

Jobs in the workspace, newest first; filter by runnerId/resourceId/status.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runnerId": {
      "type": "string"
    },
    "resourceId": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "running",
        "completed",
        "failed",
        "terminated"
      ]
    },
    "limit": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 500
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
      "runnerId": {
        "type": "string"
      },
      "runnerName": {
        "type": [
          "string",
          "null"
        ]
      },
      "resourceId": {
        "type": [
          "string",
          "null"
        ]
      },
      "command": {
        "type": "string"
      },
      "status": {
        "type": "string",
        "enum": [
          "running",
          "completed",
          "failed",
          "terminated"
        ]
      },
      "exitCode": {
        "type": [
          "number",
          "null"
        ]
      },
      "startedAt": {
        "type": "string"
      },
      "endedAt": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "runnerId",
      "runnerName",
      "resourceId",
      "command",
      "status",
      "exitCode",
      "startedAt",
      "endedAt"
    ],
    "additionalProperties": false
  }
}
```

### `GET /jobs/:id` — getJob

Job status by id.

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
    "runnerId": {
      "type": "string"
    },
    "runnerName": {
      "type": [
        "string",
        "null"
      ]
    },
    "resourceId": {
      "type": [
        "string",
        "null"
      ]
    },
    "command": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "running",
        "completed",
        "failed",
        "terminated"
      ]
    },
    "exitCode": {
      "type": [
        "number",
        "null"
      ]
    },
    "startedAt": {
      "type": "string"
    },
    "endedAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "id",
    "runnerId",
    "runnerName",
    "resourceId",
    "command",
    "status",
    "exitCode",
    "startedAt",
    "endedAt"
  ],
  "additionalProperties": false
}
```

### `POST /jobs/:id/terminate` — terminateJob

Terminates a running job (SIGTERM then SIGKILL on the runner).

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
    "runnerId": {
      "type": "string"
    },
    "runnerName": {
      "type": [
        "string",
        "null"
      ]
    },
    "resourceId": {
      "type": [
        "string",
        "null"
      ]
    },
    "command": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "running",
        "completed",
        "failed",
        "terminated"
      ]
    },
    "exitCode": {
      "type": [
        "number",
        "null"
      ]
    },
    "startedAt": {
      "type": "string"
    },
    "endedAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "id",
    "runnerId",
    "runnerName",
    "resourceId",
    "command",
    "status",
    "exitCode",
    "startedAt",
    "endedAt"
  ],
  "additionalProperties": false
}
```

### `POST /jobs/:id/input` — jobInput

Feeds stdin to a running job: {data} appends bytes; {eof:true} closes the job's stdin (EOF for the program). For interactive jobs — REPLs, confirmation prompts, anything that reads stdin mid-run.

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
    "data": {
      "type": "string"
    },
    "eof": {
      "type": "boolean"
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

### `GET /jobs/:id/tail` — tailJob

Job log tail. Without follow: current buffer, up to `lines`. With follow=1: SSE that replays then keeps streaming new lines until the job ends.

- **Auth**: `session-or-apiKey`
- **Streaming**: yes (chunked/SSE response)

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "lines": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 10000
    },
    "follow": {
      "type": "integer",
      "minimum": 0,
      "maximum": 1
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
  "type": "string"
}
```

### `POST /microvms/boot` — bootMicrovm

Boots an ephemeral Firecracker microvm on a microvm-host runner. If the identifier was never used (or is past the archive window), boots fresh; if it was idle-stopped, resumes it — /app is restored from its S3 zip first. The VM auto-shuts-down after idleShutdownSec of inactivity (zipping /app back to S3), and a command to the same identifier resumes it.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runnerId": {
      "type": "string"
    },
    "identifier": {
      "type": "string"
    },
    "memMb": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 8192
    },
    "vcpu": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 8
    },
    "idleShutdownSec": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 86400
    }
  },
  "required": [
    "identifier"
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
      "type": "string",
      "enum": [
        "running",
        "idle-stopped",
        "archived",
        "failed"
      ]
    },
    "cid": {
      "type": [
        "number",
        "null"
      ]
    },
    "bootCount": {
      "type": "number"
    },
    "lastActiveAt": {
      "type": "string"
    },
    "createdAt": {
      "type": "string"
    },
    "archivedAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "id",
    "identifier",
    "runnerId",
    "runnerName",
    "status",
    "cid",
    "bootCount",
    "lastActiveAt",
    "createdAt",
    "archivedAt"
  ],
  "additionalProperties": false
}
```

### `POST /microvms/exec` — execInMicrovm

Runs a command inside a microvm (booting/resuming it if needed) over vsock and returns the buffered output. Marks the VM active (resets its idle timer).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runnerId": {
      "type": "string"
    },
    "identifier": {
      "type": "string"
    },
    "command": {
      "type": "string"
    },
    "cwd": {
      "type": "string"
    },
    "timeoutMs": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 600000
    }
  },
  "required": [
    "runnerId",
    "identifier",
    "command"
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
    "exitCode": {
      "type": "number"
    },
    "stdout": {
      "type": "string"
    },
    "stderr": {
      "type": "string"
    },
    "durationMs": {
      "type": "number"
    }
  },
  "required": [
    "exitCode",
    "stdout",
    "stderr",
    "durationMs"
  ],
  "additionalProperties": false
}
```

### `GET /microvms` — listMicrovms

Microvms in the workspace with lifecycle status.

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
        "type": "string",
        "enum": [
          "running",
          "idle-stopped",
          "archived",
          "failed"
        ]
      },
      "cid": {
        "type": [
          "number",
          "null"
        ]
      },
      "bootCount": {
        "type": "number"
      },
      "lastActiveAt": {
        "type": "string"
      },
      "createdAt": {
        "type": "string"
      },
      "archivedAt": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "identifier",
      "runnerId",
      "runnerName",
      "status",
      "cid",
      "bootCount",
      "lastActiveAt",
      "createdAt",
      "archivedAt"
    ],
    "additionalProperties": false
  }
}
```

### `GET /microvms/:identifier/stream` — microvmStream

Raw WS relay to a microvm's terminal (pty bytes in both directions) or its VSCode fork (code-server): ?mode=terminal|vscode. Runners host the relay over vsock; dispatch bridges it to callers through the Gateway's WS passthrough.

- **Auth**: `session-or-apiKey`
- **Streaming**: yes (chunked/SSE response)

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "identifier": {
      "type": "string"
    },
    "mode": {
      "type": "string",
      "enum": [
        "terminal",
        "vscode"
      ]
    }
  },
  "required": [
    "identifier",
    "mode"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "string"
}
```

### `POST /microvms/:identifier/shutdown` — shutdownMicrovm

Shuts a microvm down gracefully: zips /app, uploads to S3 (stub), powers off. Same-identifier resume restores /app. Pass archive=1 to also sweep it for archive after inactivity.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "identifier": {
      "type": "string"
    },
    "archive": {
      "type": "integer",
      "minimum": 0,
      "maximum": 1
    }
  },
  "required": [
    "identifier"
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
      "type": "string",
      "enum": [
        "running",
        "idle-stopped",
        "archived",
        "failed"
      ]
    },
    "cid": {
      "type": [
        "number",
        "null"
      ]
    },
    "bootCount": {
      "type": "number"
    },
    "lastActiveAt": {
      "type": "string"
    },
    "createdAt": {
      "type": "string"
    },
    "archivedAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "id",
    "identifier",
    "runnerId",
    "runnerName",
    "status",
    "cid",
    "bootCount",
    "lastActiveAt",
    "createdAt",
    "archivedAt"
  ],
  "additionalProperties": false
}
```
