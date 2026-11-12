# ENDPOINTS.md — TwoDrive

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Drive/file explorer over multiple storage backends (S3-compatible or local). Virtual storages act as soft buckets with an S3-compatible API, plus an internal app-file API with per-app folders.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twodrive`
- **Capabilities**: files, storage
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T13:40:08.840Z_

## Endpoints

### `GET /backends` — listBackends

Lists registered storage backends. Secrets inside config are never returned.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "backends": {
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
          "type": {
            "type": "string",
            "enum": [
              "s3",
              "local"
            ]
          },
          "enabled": {
            "type": "boolean"
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
          "type",
          "enabled",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "storages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "backendId": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "prefix": {
            "type": "string"
          },
          "usage": {
            "type": "object",
            "properties": {
              "used": {
                "type": "number"
              },
              "files": {
                "type": "number"
              },
              "folders": {
                "type": "number"
              }
            },
            "required": [
              "used",
              "files",
              "folders"
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
          "backendId",
          "name",
          "prefix",
          "usage",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "backends",
    "storages"
  ],
  "additionalProperties": false
}
```

### `POST /backends` — createBackend

Registers a storage backend. type 's3' needs {endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle}; type 'local' needs {rootPath}. The S3 secret is encrypted at rest. Set test=true to verify reachability before saving (the call fails and nothing is stored if the backend is unreachable).

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
    "type": {
      "type": "string",
      "enum": [
        "s3",
        "local"
      ]
    },
    "config": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    },
    "enabled": {
      "type": "boolean"
    },
    "test": {
      "type": "boolean"
    }
  },
  "required": [
    "name",
    "type",
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
  "properties": {
    "id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "s3",
        "local"
      ]
    },
    "enabled": {
      "type": "boolean"
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
    "type",
    "enabled",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /backends/:id` — updateBackend

Updates a backend — rename, enable/disable, or replace config. Omitted config fields keep their current values; a present-but-empty secretAccessKey keeps the stored secret.

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
    "config": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    },
    "enabled": {
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
    "id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "s3",
        "local"
      ]
    },
    "enabled": {
      "type": "boolean"
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
    "type",
    "enabled",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /backends/:id` — deleteBackend

Deletes a backend registration. Fails while virtual storages still live on it (delete or move them first). Files on the backend itself are never deleted.

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

### `POST /backends/:id/test` — testBackend

Verifies the backend is reachable (S3 HeadBucket / local stat of the root path).

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
    "error": {
      "type": "string"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `POST /storages` — createVirtualStorage

Creates a virtual storage on a backend. `prefix` is its location inside the backend (auto-derived from the name if omitted). Optionally marks it as the default virtual storage for app files.

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
    "backendId": {
      "type": "string"
    },
    "prefix": {
      "type": "string"
    },
    "setAsDefault": {
      "type": "boolean"
    }
  },
  "required": [
    "name",
    "backendId"
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
    "backendId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "prefix": {
      "type": "string"
    },
    "usage": {
      "type": "object",
      "properties": {
        "used": {
          "type": "number"
        },
        "files": {
          "type": "number"
        },
        "folders": {
          "type": "number"
        }
      },
      "required": [
        "used",
        "files",
        "folders"
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
    "backendId",
    "name",
    "prefix",
    "usage",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /storages/:id` — updateVirtualStorage

Renames a virtual storage (prefix on the backend never moves — existing files keep working).

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
    "setAsDefault": {
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
    "id": {
      "type": "string"
    },
    "backendId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "prefix": {
      "type": "string"
    },
    "usage": {
      "type": "object",
      "properties": {
        "used": {
          "type": "number"
        },
        "files": {
          "type": "number"
        },
        "folders": {
          "type": "number"
        }
      },
      "required": [
        "used",
        "files",
        "folders"
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
    "backendId",
    "name",
    "prefix",
    "usage",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /storages/:id` — deleteVirtualStorage

Deletes a virtual storage registration (with confirm=true, hard-deletes its files from the backend too). The default-virtual-storage setting is cleared if it pointed here; apps inserting files will error until a new default is set.

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
    "confirm": {
      "type": "boolean"
    },
    "hardDelete": {
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

### `GET /storages/default` — getDefaultStorage

The workspace's default virtual storage — where app folders live when an app has no override. Null when none is set (app file APIs return errors in that state).

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "virtualStorageId": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "virtualStorageId"
  ],
  "additionalProperties": false
}
```

### `PUT /storages/default` — setDefaultStorage

Sets (or clears, with null) the default virtual storage for app files.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "virtualStorageId": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "virtualStorageId"
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
    "virtualStorageId": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "virtualStorageId"
  ],
  "additionalProperties": false
}
```

### `GET /storages/:storageId/entries` — listEntries

Lists direct children of a folder. ?path= selects the folder (root by default); ?trash=true lists trashed entries.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "path": {
      "type": "string"
    },
    "trash": {
      "type": "boolean"
    }
  },
  "required": [
    "storageId"
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
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "path": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "file",
              "folder"
            ]
          },
          "size": {
            "type": "number"
          },
          "mimeType": {
            "type": [
              "string",
              "null"
            ]
          },
          "previewType": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "image",
                  "video",
                  "audio",
                  "pdf",
                  "text",
                  "archive",
                  "other"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "deleted": {
            "type": "boolean"
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
          "path",
          "name",
          "type",
          "size",
          "mimeType",
          "previewType",
          "deleted",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "entries"
  ],
  "additionalProperties": false
}
```

### `POST /storages/:storageId/folders` — createFolder

Creates a folder (intermediate folders are created too).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "path": {
      "type": "string"
    }
  },
  "required": [
    "storageId",
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
    "id": {
      "type": "string"
    },
    "path": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "file",
        "folder"
      ]
    },
    "size": {
      "type": "number"
    },
    "mimeType": {
      "type": [
        "string",
        "null"
      ]
    },
    "previewType": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "image",
            "video",
            "audio",
            "pdf",
            "text",
            "archive",
            "other"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "deleted": {
      "type": "boolean"
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
    "path",
    "name",
    "type",
    "size",
    "mimeType",
    "previewType",
    "deleted",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `POST /storages/:storageId/files` — uploadFile

Uploads a file. Raw body (any content type) with ?path=target.ext — the path includes the file name. Parent folders are tracked automatically.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "path": {
      "type": "string"
    }
  },
  "required": [
    "storageId",
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
    "id": {
      "type": "string"
    },
    "path": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "file",
        "folder"
      ]
    },
    "size": {
      "type": "number"
    },
    "mimeType": {
      "type": [
        "string",
        "null"
      ]
    },
    "previewType": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "image",
            "video",
            "audio",
            "pdf",
            "text",
            "archive",
            "other"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "deleted": {
      "type": "boolean"
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
    "path",
    "name",
    "type",
    "size",
    "mimeType",
    "previewType",
    "deleted",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `GET /storages/:storageId/files/*` — downloadFile

Downloads a file. ?download=1 forces a download attachment; streams with range support.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    }
  },
  "required": [
    "storageId"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

### `PATCH /storages/:storageId/entries/rename` — renameEntry

Renames a file or folder within its parent folder.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "path": {
      "type": "string"
    },
    "newName": {
      "type": "string"
    }
  },
  "required": [
    "storageId",
    "path",
    "newName"
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
    "path": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "file",
        "folder"
      ]
    },
    "size": {
      "type": "number"
    },
    "mimeType": {
      "type": [
        "string",
        "null"
      ]
    },
    "previewType": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "image",
            "video",
            "audio",
            "pdf",
            "text",
            "archive",
            "other"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "deleted": {
      "type": "boolean"
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
    "path",
    "name",
    "type",
    "size",
    "mimeType",
    "previewType",
    "deleted",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /storages/:storageId/entries/move` — moveEntry

Moves a file or folder to a new path inside the same virtual storage.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "from": {
      "type": "string"
    },
    "to": {
      "type": "string"
    }
  },
  "required": [
    "storageId",
    "from",
    "to"
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

### `POST /storages/:storageId/entries/copy` — copyEntry

Copies a file or folder to a new path inside the same virtual storage.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "from": {
      "type": "string"
    },
    "to": {
      "type": "string"
    }
  },
  "required": [
    "storageId",
    "from",
    "to"
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

### `POST /storages/:storageId/entries/trash` — trashEntries

Moves files/folders to trash (soft delete — restore is possible).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "paths": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "storageId",
    "paths"
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

### `POST /storages/:storageId/entries/restore` — restoreEntries

Restores trashed entries by id.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "entryIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "storageId",
    "entryIds"
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

### `POST /storages/:storageId/entries/purge` — purgeEntries

Permanently deletes trashed entries by path from the table and the backend. Irreversible.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "paths": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "storageId",
    "paths"
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
    "deleted": {
      "type": "number"
    }
  },
  "required": [
    "ok",
    "deleted"
  ],
  "additionalProperties": false
}
```

### `POST /storages/:storageId/trash/empty` — emptyTrash

Permanently deletes everything in this virtual storage's trash.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    }
  },
  "required": [
    "storageId"
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
    "deleted": {
      "type": "number"
    }
  },
  "required": [
    "ok",
    "deleted"
  ],
  "additionalProperties": false
}
```

### `GET /storages/:storageId/search` — searchFiles

Full-tree search by path substring, case-insensitive.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "query": {
      "type": "string"
    },
    "limit": {
      "type": "number"
    }
  },
  "required": [
    "storageId",
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
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "path": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "file",
              "folder"
            ]
          },
          "size": {
            "type": "number"
          },
          "mimeType": {
            "type": [
              "string",
              "null"
            ]
          },
          "previewType": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "image",
                  "video",
                  "audio",
                  "pdf",
                  "text",
                  "archive",
                  "other"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "deleted": {
            "type": "boolean"
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
          "path",
          "name",
          "type",
          "size",
          "mimeType",
          "previewType",
          "deleted",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "entries"
  ],
  "additionalProperties": false
}
```

### `GET /storages/:storageId/recent` — recentFiles

Most recently updated live files in this virtual storage.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "limit": {
      "type": "number"
    }
  },
  "required": [
    "storageId"
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
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "path": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "file",
              "folder"
            ]
          },
          "size": {
            "type": "number"
          },
          "mimeType": {
            "type": [
              "string",
              "null"
            ]
          },
          "previewType": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "image",
                  "video",
                  "audio",
                  "pdf",
                  "text",
                  "archive",
                  "other"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "deleted": {
            "type": "boolean"
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
          "path",
          "name",
          "type",
          "size",
          "mimeType",
          "previewType",
          "deleted",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "entries"
  ],
  "additionalProperties": false
}
```

### `POST /storages/:storageId/shares` — createShareLink

Creates a public share link for a file (or a folder — folder shares download as a zip later).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "path": {
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
    "storageId",
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
    "token": {
      "type": "string"
    },
    "url": {
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
    "url",
    "expiresAt"
  ],
  "additionalProperties": false
}
```

### `GET /storages/:storageId/shares` — listShareLinks

Lists active share links for a virtual storage.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    }
  },
  "required": [
    "storageId"
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
    "shares": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "token": {
            "type": "string"
          },
          "path": {
            "type": "string"
          },
          "entryId": {
            "type": "string"
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
          "token",
          "path",
          "entryId",
          "expiresAt",
          "createdAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "shares"
  ],
  "additionalProperties": false
}
```

### `DELETE /storages/:storageId/shares/:token` — revokeShareLink

Revokes a share link.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "token": {
      "type": "string"
    }
  },
  "required": [
    "storageId",
    "token"
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

### `GET /shares/:token` — getSharedFile

Public (no auth) download of a shared file. 404s when revoked or expired.

- **Auth**: `public`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "token": {
      "type": "string"
    }
  },
  "required": [
    "token"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

### `PUT /app/objects/*` — appPutFile

Inserts (or overwrites) an object for the calling app. Path is relative to the app's folder inside its virtual storage. Requires the x-twodb-app header; errors with 409 no_default_storage when no default virtual storage is set and the app has no override.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    }
  },
  "required": [
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
    "path": {
      "type": "string"
    },
    "fullPath": {
      "type": "string"
    },
    "storageId": {
      "type": "string"
    },
    "size": {
      "type": "number"
    }
  },
  "required": [
    "path",
    "fullPath",
    "storageId",
    "size"
  ],
  "additionalProperties": false
}
```

### `GET /app/objects/*` — appGetFile

Fetches an object by app-relative path (raw bytes). Requires the x-twodb-app header.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    }
  },
  "required": [
    "path"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

### `PATCH /app/objects/*` — appPatchFile

Moves/renames an app object. Body: {to: 'new/relative/path'} — relative to the app folder. Requires the x-twodb-app header.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    },
    "to": {
      "type": "string"
    }
  },
  "required": [
    "path",
    "to"
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
    "fullPath": {
      "type": "string"
    }
  },
  "required": [
    "path",
    "fullPath"
  ],
  "additionalProperties": false
}
```

### `DELETE /app/objects/*` — appDeleteFile

Trashes an app object by app-relative path. Requires the x-twodb-app header.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "path": {
      "type": "string"
    }
  },
  "required": [
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
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `GET /app/objects` — appListFiles

Lists the calling app's folder (recursive, or one level with ?flat=false). Requires the x-twodb-app header.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "prefix": {
      "type": "string"
    },
    "recursive": {
      "type": "boolean"
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
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "file",
              "folder"
            ]
          },
          "size": {
            "type": "number"
          },
          "updatedAt": {
            "type": "string"
          }
        },
        "required": [
          "path",
          "type",
          "size",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "entries"
  ],
  "additionalProperties": false
}
```

### `GET /app-overrides` — listAppOverrides

Lists per-app virtual storage overrides (app identifier → virtual storage).

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "overrides": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "appId": {
            "type": "string"
          },
          "virtualStorageId": {
            "type": "string"
          },
          "createdAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "appId",
          "virtualStorageId",
          "createdAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "overrides"
  ],
  "additionalProperties": false
}
```

### `PUT /app-overrides/:appId` — setAppOverride

Points an app's file folder at a specific virtual storage. With virtualStorageId=null, clears the override (the app falls back to the default).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "appId": {
      "type": "string"
    },
    "virtualStorageId": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "appId",
    "virtualStorageId"
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

### `GET /storages/:storageId/keys` — listAccessKeys

Lists access keys for a virtual storage's S3-compatible endpoint (secrets never returned).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    }
  },
  "required": [
    "storageId"
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
    "keys": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "accessKeyId": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "createdAt": {
            "type": "string"
          },
          "lastUsedAt": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "accessKeyId",
          "label",
          "createdAt",
          "lastUsedAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "keys"
  ],
  "additionalProperties": false
}
```

### `POST /storages/:storageId/keys` — createAccessKey

Creates an access key pair for the S3-compatible endpoint. The secret is returned once, stored only as a hash.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "label": {
      "type": "string"
    }
  },
  "required": [
    "storageId"
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
    "accessKeyId": {
      "type": "string"
    },
    "secretAccessKey": {
      "type": "string"
    },
    "label": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "accessKeyId",
    "secretAccessKey",
    "label"
  ],
  "additionalProperties": false
}
```

### `DELETE /storages/:storageId/keys/:id` — deleteAccessKey

Deletes an access key (S3 API calls with it start failing immediately).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "storageId",
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

### `GET /s3/:storageId/*` — s3Api

S3-compatible surface for a virtual storage (GET/HEAD/PUT/DELETE object, GET bucket list-objects). Simplified auth: accessKeyId + x-amz-secret (or Authorization: AWS <accessKeyId>:<secret>) headers — no SigV4. Paths map directly inside the virtual storage.

- **Auth**: `public`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "storageId": {
      "type": "string"
    }
  },
  "required": [
    "storageId"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```
