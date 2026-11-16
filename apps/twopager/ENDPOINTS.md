# ENDPOINTS.md — TwoPager

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Static site hosting and the gateway's catch-all: landing pages on custom domains. A site belongs to a space and has versions (one active, Firebase-Hosting style); agents add pages to a draft version or upload a zip. SPA rewrites, redirects and headers per version. Files live in S3, records in Postgres, and are served from a local cache.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twopager/api`
- **Capabilities**: sites, hosting, static-sites
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-16T02:40:02.048Z_

## Endpoints

### `GET /sites` — listSites

Sites of a space. Each site has hosts (custom domains + built-in `<slug>.<SITES_DOMAIN>` when configured) and an active version.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "spaceId": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "spaceId"
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
    "propertyNames": {
      "type": "string"
    },
    "additionalProperties": {}
  }
}
```

### `POST /sites` — createSite

Create a site in a space (`slug` is the globally unique built-in subdomain; derived from `name` when omitted). Optionally attach custom `domains` right away.

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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `GET /sites/:siteId` — getSite

One site with its hosts and active version.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "siteId"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `PATCH /sites/:siteId` — renameSite

Rename a site (the slug and domains are unchanged).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 80
    }
  },
  "required": [
    "siteId",
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /sites/:siteId` — deleteSite

Delete a site with all its versions, files (also removed from S3) and domains. Takes the site offline immediately.

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

### `POST /sites/:siteId/domains` — addDomain

Attach a custom domain. Point its DNS (CNAME/A) at the TwoDB gateway and make sure TLS for it terminates in front of the gateway; requests whose Host matches are served from the site's active version. A domain can belong to one site only.

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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /sites/:siteId/domains/:host` — removeDomain

Detach a custom domain from the site.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    },
    "host": {
      "type": "string",
      "minLength": 3
    }
  },
  "required": [
    "siteId",
    "host"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `GET /sites/:siteId/versions` — listVersions

All versions of a site, newest first. `active` marks the live one. Roll back by activating an older version.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "siteId"
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
    "propertyNames": {
      "type": "string"
    },
    "additionalProperties": {}
  }
}
```

### `POST /sites/:siteId/versions` — createVersion

Start a new DRAFT version. Seed it from an existing version with `fromVersionId` (or `fromActive: true`) to edit/add pages on top of the live site; omit both for an empty one. Then PUT files, optionally set the config, and finalize (+activate).

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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `GET /sites/:siteId/versions/:versionId` — getVersion

One version with its file list (path, size, contentType, sha256) and config.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    },
    "versionId": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "siteId",
    "versionId"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `PUT /sites/:siteId/versions/:versionId/files` — putFiles

Add or replace pages/assets in a DRAFT version (up to 500 per call). Text via `content`, binary via `contentBase64`. A file named `twopager.json` sets the version config instead of being served.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    },
    "versionId": {
      "type": "string",
      "minLength": 1
    },
    "files": {
      "minItems": 1,
      "maxItems": 500,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 512,
            "description": "File path inside the site, e.g. `index.html` or `blog/post-1/index.html`"
          },
          "content": {
            "description": "UTF-8 text content (HTML, CSS, JS, …)",
            "type": "string"
          },
          "contentBase64": {
            "description": "Base64 content for binary files (images, fonts, …)",
            "type": "string"
          },
          "contentType": {
            "description": "Overrides the type guessed from the extension",
            "type": "string",
            "maxLength": 200
          }
        },
        "required": [
          "path"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "siteId",
    "versionId",
    "files"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /sites/:siteId/versions/:versionId/files` — deleteFile

Remove one file (by `path` query parameter) from a DRAFT version.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    },
    "versionId": {
      "type": "string",
      "minLength": 1
    },
    "path": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "siteId",
    "versionId",
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `GET /sites/:siteId/versions/:versionId/file` — getFile

Read one file of any version: `{path, contentType, size, sha256, encoding: utf8|base64, content}`.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    },
    "versionId": {
      "type": "string",
      "minLength": 1
    },
    "path": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "siteId",
    "versionId",
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `PUT /sites/:siteId/versions/:versionId/config` — setVersionConfig

Replace the serving config of a DRAFT version. Fields: `spa` (catch-all rewrite to /index.html), `cleanUrls`, `trailingSlash`, `rewrites:[{source,destination}]`, `redirects:[{source,destination,type}]`, `headers:[{source,headers:[{key,value}]}]`, `notFoundPage`. Sources are globs (`**`, `*`, `?`, `{a,b}`, `:name`). Order: redirects → static file → rewrites → 404.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    },
    "versionId": {
      "type": "string",
      "minLength": 1
    },
    "config": {
      "type": "object",
      "properties": {
        "spa": {
          "type": "boolean"
        },
        "cleanUrls": {
          "type": "boolean"
        },
        "trailingSlash": {
          "type": "boolean"
        },
        "rewrites": {
          "maxItems": 100,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "source": {
                "type": "string",
                "minLength": 1,
                "maxLength": 300
              },
              "destination": {
                "type": "string",
                "minLength": 1,
                "maxLength": 2000
              }
            },
            "required": [
              "source",
              "destination"
            ],
            "additionalProperties": false
          }
        },
        "redirects": {
          "maxItems": 100,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "source": {
                "type": "string",
                "minLength": 1,
                "maxLength": 300
              },
              "destination": {
                "type": "string",
                "minLength": 1,
                "maxLength": 2000
              },
              "type": {
                "anyOf": [
                  {
                    "type": "number",
                    "const": 301
                  },
                  {
                    "type": "number",
                    "const": 302
                  },
                  {
                    "type": "number",
                    "const": 307
                  },
                  {
                    "type": "number",
                    "const": 308
                  }
                ]
              }
            },
            "required": [
              "source",
              "destination"
            ],
            "additionalProperties": false
          }
        },
        "headers": {
          "maxItems": 100,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "source": {
                "type": "string",
                "minLength": 1,
                "maxLength": 300
              },
              "headers": {
                "maxItems": 30,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "key": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 100,
                      "pattern": "^[A-Za-z0-9-]+$"
                    },
                    "value": {
                      "type": "string",
                      "maxLength": 2048
                    }
                  },
                  "required": [
                    "key",
                    "value"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "source",
              "headers"
            ],
            "additionalProperties": false
          }
        },
        "notFoundPage": {
          "type": "string",
          "maxLength": 300
        }
      },
      "additionalProperties": false
    }
  },
  "required": [
    "siteId",
    "versionId",
    "config"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `POST /sites/:siteId/versions/:versionId/finalize` — finalizeVersion

Freeze a draft (it becomes immutable). With `activate: true` it goes live immediately.

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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `POST /sites/:siteId/activate` — activateVersion

Make a finalized version the live one (also how you roll back). Takes effect within seconds.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    },
    "versionId": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "siteId",
    "versionId"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /sites/:siteId/versions/:versionId` — deleteVersion

Delete a version that is not active. Blobs no other version uses are removed from S3.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "siteId": {
      "type": "string",
      "minLength": 1
    },
    "versionId": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "siteId",
    "versionId"
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

### `POST /sites/:siteId/versions/zip` — uploadZip

Publish a whole site from a zip in one call. Send the zip as the RAW request body (`Content-Type: application/zip`, query: message, activate) or as JSON `{zipBase64, message, activate}`. The zip is a full snapshot: it becomes a new finalized version (a single wrapping folder is stripped, `twopager.json` at the root is the config) and, unless `activate: false`, goes live.

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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `POST /sites/:siteId/pages` — publishPage

One-shot: add or replace pages on top of the live site. Clones the active version (or starts empty), writes `pages`, finalizes and — unless `activate: false` — activates the result. Use this for small edits by an agent; use the draft endpoints or a zip for bigger changes.

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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```
