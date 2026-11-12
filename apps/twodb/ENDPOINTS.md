# ENDPOINTS.md — TwoDB

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

The control plane: Docker-based app installation/lifecycle management, Postgres schema provisioning, identity (TwoAuth), and the Gateway every other app's traffic flows through.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T19:52:06.915Z_

## Endpoints

### `POST /registry/register` — registerApp

App-initiated registration — the only way an app becomes known to the gateway. Authenticate with `x-twodb-app` + `x-twodb-token` (re-registration) or the shared `x-twodb-registration-secret` (TWODB_REGISTRATION_SECRET); the secret path mints and returns a 30-day app token. Managed containers use the non-expiring token TwoDB injected (TWODB_APP_TOKEN).

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
    "httpUrl": {
      "type": "string"
    },
    "socketPath": {
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
    },
    "created": {
      "type": "boolean"
    },
    "token": {
      "type": "string"
    },
    "expiresAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "ok",
    "created"
  ],
  "additionalProperties": false
}
```

### `POST /registry/ping` — pingApp

Heartbeat (auth: x-twodb-app + x-twodb-token). Apps ping every 10s; after 30s of silence the control plane marks the app inactive.

- **Auth**: `public`

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
    "pong": {
      "type": "boolean",
      "const": true
    },
    "intervalMs": {
      "type": "number"
    },
    "timeoutMs": {
      "type": "number"
    }
  },
  "required": [
    "ok",
    "pong",
    "intervalMs",
    "timeoutMs"
  ],
  "additionalProperties": false
}
```

### `GET /registry/config` — getAppConfig

Runtime config for the calling app (auth: x-twodb-app + x-twodb-token): its Postgres connection/schema/role, its S3 bucket + key prefix + credentials (null when S3 isn't configured), and its stable data key. Consumed by twodb-core.

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
    "postgres": {
      "type": "object",
      "properties": {
        "connectionString": {
          "type": "string"
        },
        "schema": {
          "type": "string"
        },
        "role": {
          "type": "string"
        }
      },
      "required": [
        "connectionString",
        "schema",
        "role"
      ],
      "additionalProperties": false
    },
    "s3": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "bucket": {
              "type": "string"
            },
            "prefix": {
              "type": "string"
            },
            "region": {
              "type": [
                "string",
                "null"
              ]
            },
            "endpoint": {
              "type": [
                "string",
                "null"
              ]
            },
            "forcePathStyle": {
              "type": "boolean"
            },
            "accessKeyId": {
              "type": "string"
            },
            "secretAccessKey": {
              "type": "string"
            }
          },
          "required": [
            "bucket",
            "prefix",
            "region",
            "endpoint",
            "forcePathStyle",
            "accessKeyId",
            "secretAccessKey"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "dataKey": {
      "type": "string"
    }
  },
  "required": [
    "slug",
    "postgres",
    "s3"
  ],
  "additionalProperties": false
}
```

### `POST /registry/oauth/authorize` — oauthAuthorize

"Login with TwoDB" step 1 (called by the TwoDB webapp /authorize page with the user's own session): issues a one-time 60s authorization code bound to the PKCE challenge and an allowed redirect URI, and returns where to send the browser.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "redirectUri": {
      "type": "string"
    },
    "codeChallenge": {
      "type": "string"
    },
    "state": {
      "type": "string"
    }
  },
  "required": [
    "redirectUri",
    "codeChallenge"
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
    "redirectTo": {
      "type": "string"
    }
  },
  "required": [
    "redirectTo"
  ],
  "additionalProperties": false
}
```

### `POST /registry/oauth/token` — oauthToken

"Login with TwoDB" step 2 (called by the app webapp): exchanges the code + PKCE verifier for a session token, usable as `Authorization: Bearer <accessToken>` on every gateway route and /api/auth/*.

- **Auth**: `public`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "code": {
      "type": "string"
    },
    "codeVerifier": {
      "type": "string"
    },
    "redirectUri": {
      "type": "string"
    }
  },
  "required": [
    "code",
    "codeVerifier",
    "redirectUri"
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
    "tokenType": {
      "type": "string",
      "const": "Bearer"
    },
    "accessToken": {
      "type": "string"
    },
    "expiresAt": {
      "type": "string"
    }
  },
  "required": [
    "tokenType",
    "accessToken",
    "expiresAt"
  ],
  "additionalProperties": false
}
```

### `POST /registry/apps/:slug/tokens` — createAppToken

Mints a 30-day app token for an app TwoDB doesn't run. Plaintext returned once.

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
    "token": {
      "type": "string"
    },
    "expiresAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "token",
    "expiresAt"
  ],
  "additionalProperties": false
}
```

### `GET /registry/apps/:slug/tokens` — listAppTokens

Token metadata for an app (never the token itself).

- **Auth**: `session`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "tokens": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "slug": {
            "type": "string"
          },
          "kind": {
            "type": "string"
          },
          "created_at": {
            "type": "string"
          },
          "expires_at": {
            "type": [
              "string",
              "null"
            ]
          },
          "revoked_at": {
            "type": [
              "string",
              "null"
            ]
          },
          "last_used_at": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "slug",
          "kind",
          "created_at",
          "expires_at",
          "revoked_at",
          "last_used_at"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "tokens"
  ],
  "additionalProperties": false
}
```

### `POST /registry/apps/:slug/rotate-token` — rotateAppToken

Rotates the app's token (user session only). Unmanaged: revokes old tokens and returns a new 30-day token once. Managed: mints a new non-expiring token and recreates the container (async — poll getAppStatus), then revokes the old one.

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
    "ok": {
      "type": "boolean",
      "const": true
    },
    "managed": {
      "type": "boolean"
    },
    "token": {
      "type": "string"
    },
    "expiresAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "type": "string"
    }
  },
  "required": [
    "ok",
    "managed"
  ],
  "additionalProperties": false
}
```

### `DELETE /registry/tokens/:id` — revokeAppToken

Revokes an app token immediately.

- **Auth**: `session`

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

### `GET /registry/api-keys` — listApiKeys

Lists the caller's workspace API keys (workspace platform's api_key table — the ones x-api-key auth verifies). Hashes never leave the DB; revoked keys are included with their revokedAt set.

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
      "prefix": {
        "type": "string"
      },
      "scopes": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "createdAt": {
        "type": "string"
      },
      "lastUsedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "revokedAt": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "name",
      "prefix",
      "scopes",
      "createdAt",
      "lastUsedAt",
      "revokedAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /registry/api-keys` — createApiKey

Issues a workspace API key. The raw key (format twodb_<prefix>_<secret>) is returned EXACTLY ONCE — only its sha256 is stored. Use it as the x-api-key header on gateway calls.

- **Auth**: `session`

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
    "key": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "prefix": {
          "type": "string"
        },
        "scopes": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "createdAt": {
          "type": "string"
        },
        "lastUsedAt": {
          "type": [
            "string",
            "null"
          ]
        },
        "revokedAt": {
          "type": [
            "string",
            "null"
          ]
        }
      },
      "required": [
        "id",
        "name",
        "prefix",
        "scopes",
        "createdAt",
        "lastUsedAt",
        "revokedAt"
      ],
      "additionalProperties": false
    },
    "rawKey": {
      "type": "string"
    }
  },
  "required": [
    "key",
    "rawKey"
  ],
  "additionalProperties": false
}
```

### `DELETE /registry/api-keys/:id` — revokeApiKey

Revokes one of the caller's workspace API keys. Scoped to the workspace: ids from another workspace 404.

- **Auth**: `session`

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

### `GET /registry/spaces` — listSpaces

Lists the caller's workspace spaces — the sub-scopes that apps (e.g. TwoRoute connections) link themselves to.

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
      "createdAt": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "id",
      "name",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /registry/spaces` — createSpace

Creates a space in the caller's workspace.

- **Auth**: `session`

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
    "space": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "name"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "space"
  ],
  "additionalProperties": false
}
```

### `POST /orchestrator/apps/:slug/install` — installApp

Full one-click install: provisions the app's Postgres schema, resolves its Docker image (pulls `$TWODB_APP_IMAGE_REGISTRY/app-<slug>:<version ?? latest>` when a registry is configured, otherwise builds locally from the workspace at its package.json version), mints a non-expiring app token (TWODB_APP_TOKEN), and starts the container. Async — poll getAppStatus until installStatus is "running" and registrationStatus is "active".

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

### `POST /orchestrator/apps/:slug/issue-token` — issueAppToken

Mints a 30-day app token without touching Docker — for running an app directly via `pnpm dev` instead of as a container. Returns the plaintext token exactly once.

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
    "appToken": {
      "type": "string"
    },
    "expiresAt": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "appToken",
    "expiresAt"
  ],
  "additionalProperties": false
}
```

### `POST /orchestrator/apps/:slug/provision-db` — provisionDatabase

Creates (idempotently — credentials are NOT changed on repeat calls unless `rotate: true`) a Postgres role+schema for the named app, independent of Docker, and ensures its stable per-app data key exists (TWODB_DATA_KEY — never rotated, unlike registration tokens). Returns both connection-string forms + the data key exactly once.

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
