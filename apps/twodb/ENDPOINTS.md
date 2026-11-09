# ENDPOINTS.md — TwoDB

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

The control plane: app registry/self-registration, Postgres schema provisioning, identity (TwoAuth), and the Gateway every other app's traffic flows through.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-09T12:16:36.538Z_

## Endpoints

### `POST /registry/register` — registerApp

Self-registration endpoint every app calls on boot (shared-secret guarded via x-provision-token, not session/API-key auth — this is how an app first introduces itself before it has any workspace context).

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
    "name": {
      "type": "string"
    },
    "version": {
      "type": "string"
    },
    "shape": {
      "type": "string",
      "enum": [
        "backend",
        "backend+webapp"
      ]
    },
    "basePath": {
      "type": "string"
    },
    "httpUrl": {
      "type": "string"
    },
    "socketPath": {
      "type": "string"
    },
    "hostId": {
      "type": "string"
    },
    "capabilities": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "manifest": {}
  },
  "required": [
    "slug",
    "name",
    "version",
    "shape",
    "basePath",
    "httpUrl",
    "capabilities",
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

Lists every app currently registered with TwoDB.

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
      }
    },
    "required": [
      "slug",
      "name",
      "basePath",
      "status"
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

### `POST /registry/apps/:slug/provision` — provisionApp

Creates (or rotates) a Postgres role+schema for the named app. Returns the connection string exactly once.

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
    }
  },
  "required": [
    "schema",
    "role",
    "connectionString"
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
