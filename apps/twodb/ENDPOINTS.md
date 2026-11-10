# ENDPOINTS.md — TwoDB

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

The control plane: Docker-based app installation/lifecycle management, Postgres schema provisioning, identity (TwoAuth), and the Gateway every other app's traffic flows through.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-10T05:38:14.379Z_

## Endpoints

### `POST /registry/register` — registerApp

An installed app calls this once it boots, presenting the unique per-app registration token TwoDB generated for it at install time (not session/API-key auth — the app has no workspace context yet). There is no shared secret: a token only ever authenticates the one slug it was issued for.

- **Auth**: `public`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    },
    "registrationToken": {
      "type": "string"
    },
    "httpUrl": {
      "type": "string"
    },
    "socketPath": {
      "type": "string"
    },
    "manifest": {}
  },
  "required": [
    "slug",
    "registrationToken",
    "httpUrl",
    "manifest"
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

### `GET /registry/apps` — listApps

Lists every app TwoDB knows about (installed, running, stopped, or not-yet-registered).

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "slug": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "basePath": {
        "type": "string"
      },
      "status": {
        "type": "string"
      },
      "installStatus": {
        "type": "string"
      }
    },
    "required": [
      "slug",
      "name",
      "basePath",
      "status",
      "installStatus"
    ],
    "additionalProperties": false
  }
}
```

### `GET /registry/apps/:slug/endpoint.json` — getAppManifest

Returns one app's cached endpoint.json, as last reported at registration time.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    }
  },
  "required": [
    "slug"
  ],
  "additionalProperties": false
}
```

### `GET /registry/apps/:slug/messages.json` — getAppMessages

Returns one app's messages contract (queue jobs + broadcast events) from its checked-in messages.json — unlike endpoint.json this isn't self-reported at registration, TwoDB serves the copy from its own monorepo checkout.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    }
  },
  "required": [
    "slug"
  ],
  "additionalProperties": false
}
```

### `GET /orchestrator/catalog` — listCatalog

Lists every app available to install (the static catalog — see src/orchestrator/catalog.ts).

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "slug": {
        "type": "string"
      },
      "hostPort": {
        "type": "number"
      }
    },
    "required": [
      "slug",
      "hostPort"
    ],
    "additionalProperties": false
  }
}
```

### `POST /orchestrator/apps/:slug/install` — installApp

Full one-click install: provisions the app's Postgres schema, resolves its Docker image (pulls `$TWODB_APP_IMAGE_REGISTRY/app-<slug>:<version ?? latest>` when a registry is configured, otherwise builds locally from the workspace at its package.json version), issues a unique registration token, and starts the container. Async — poll getAppStatus until installStatus is "running" and registrationStatus is "active".

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    },
    "version": {
      "type": "string"
    }
  },
  "required": [
    "slug"
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
    },
    "status": {
      "type": "string",
      "const": "installing"
    }
  },
  "required": [
    "ok",
    "status"
  ],
  "additionalProperties": false
}
```

### `POST /orchestrator/apps/:slug/issue-token` — issueRegistrationToken

Issues a registration token without touching Docker — for running an app directly via `pnpm dev` instead of as a container. Returns the plaintext token exactly once.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    }
  },
  "required": [
    "slug"
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
    "registrationToken": {
      "type": "string"
    }
  },
  "required": [
    "registrationToken"
  ],
  "additionalProperties": false
}
```

### `POST /orchestrator/apps/:slug/provision-db` — provisionDatabase

Creates (or rotates) a Postgres role+schema for the named app, independent of Docker, and ensures its stable per-app data key exists (TWODB_DATA_KEY — never rotated, unlike registration tokens). Returns both connection-string forms + the data key exactly once.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    }
  },
  "required": [
    "slug"
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
    "schema": {
      "type": "string"
    },
    "role": {
      "type": "string"
    },
    "connectionString": {
      "type": "string"
    },
    "containerConnectionString": {
      "type": "string"
    },
    "dataKey": {
      "type": "string"
    }
  },
  "required": [
    "schema",
    "role",
    "connectionString",
    "containerConnectionString",
    "dataKey"
  ],
  "additionalProperties": false
}
```

### `POST /orchestrator/apps/:slug/start` — startApp

Starts a previously-installed app's stopped container.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    }
  },
  "required": [
    "slug"
  ],
  "additionalProperties": false
}
```

### `POST /orchestrator/apps/:slug/stop` — stopApp

Stops a running app's container without removing it.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    }
  },
  "required": [
    "slug"
  ],
  "additionalProperties": false
}
```

### `POST /orchestrator/apps/:slug/restart` — restartApp

Restarts an app's container in place (same image, same DB).

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    }
  },
  "required": [
    "slug"
  ],
  "additionalProperties": false
}
```

### `POST /orchestrator/apps/:slug/upgrade` — upgradeApp

Re-resolves the app's image (to `version` if given, otherwise the registry's `latest` or the local workspace's current package.json version) and recreates its container against the same Postgres schema, with a freshly issued registration token. Async — poll getAppStatus.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    },
    "version": {
      "type": "string"
    }
  },
  "required": [
    "slug"
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
    },
    "status": {
      "type": "string",
      "const": "installing"
    }
  },
  "required": [
    "ok",
    "status"
  ],
  "additionalProperties": false
}
```

### `DELETE /orchestrator/apps/:slug` — removeApp

Removes the app's container and its registry row. Does NOT drop its Postgres schema — that's a deliberately separate, more dangerous operation left for a future endpoint.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    }
  },
  "required": [
    "slug"
  ],
  "additionalProperties": false
}
```

### `GET /orchestrator/apps/:slug/status` — getAppStatus

Combined install/registration/container status for one app — poll this after install/upgrade/restart.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "slug": {
      "type": "string"
    }
  },
  "required": [
    "slug"
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
    "slug": {
      "type": "string"
    },
    "installStatus": {
      "type": "string"
    },
    "registrationStatus": {
      "type": "string"
    },
    "containerStatus": {
      "type": "string"
    },
    "version": {
      "type": [
        "string",
        "null"
      ]
    },
    "imageTag": {
      "type": [
        "string",
        "null"
      ]
    },
    "lastSeenAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "slug",
    "installStatus",
    "registrationStatus",
    "containerStatus",
    "version",
    "imageTag",
    "lastSeenAt"
  ],
  "additionalProperties": false
}
```

### `POST /search` — search

Federated search — fans a query out to every app that declared the `search` capability.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "query": {
      "type": "string"
    }
  },
  "required": [
    "query"
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
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "app": {
            "type": "string"
          },
          "results": {
            "type": "array",
            "items": {}
          },
          "error": {
            "type": "string"
          }
        },
        "required": [
          "app",
          "results"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "results"
  ],
  "additionalProperties": false
}
```

### `GET /apps/:slug/*` — proxy

Generic reverse proxy to a registered app, over whichever transport (unix socket same-host, TCP otherwise) the registry chose. All methods are supported, not just GET; streaming responses are passed through unbuffered.

- **Auth**: `session-or-apiKey`
- **Streaming**: yes (chunked/SSE response)
