# ENDPOINTS.md — TwoPin

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Pinterest-style link boards: save URLs to boards; metadata (title, description, preview image, favicon) is fetched and stored server-side. See AGENTS.md.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twopin`
- **Capabilities**: boards, pins, link-metadata
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T15:23:54.145Z_

## Endpoints

### `GET /boards` — listBoards

Lists the caller's workspace boards with pin counts, oldest first.

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
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": "string"
      },
      "description": {
        "type": [
          "string",
          "null"
        ]
      },
      "pinCount": {
        "type": "number"
      },
      "createdBy": {
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
      "description",
      "pinCount",
      "createdBy",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /boards` — createBoard

Creates a board. `spaceId` is optional (boards can be workspace-wide).

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
    "spaceId": {
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
    "id": {
      "type": "string"
    },
    "spaceId": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": [
        "string",
        "null"
      ]
    },
    "pinCount": {
      "type": "number"
    },
    "createdBy": {
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
    "description",
    "pinCount",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /boards/:id` — updateBoard

Renames a board, edits its description, or moves it to a space. Only fields present are changed.

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
      "type": [
        "string",
        "null"
      ]
    },
    "spaceId": {
      "type": [
        "string",
        "null"
      ]
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
    "spaceId": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": [
        "string",
        "null"
      ]
    },
    "pinCount": {
      "type": "number"
    },
    "createdBy": {
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
    "description",
    "pinCount",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /boards/:id` — deleteBoard

Deletes a board and all its pins (cascade).

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

### `GET /pins` — listPins

Lists pins in the workspace, newest first; pass `?boardId=` to scope to one board. Binary assets are never inlined — use hasImage/hasFavicon with the /pins/:id/image and /pins/:id/favicon endpoints.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "boardId": {
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
      "boardId": {
        "type": "string"
      },
      "url": {
        "type": "string"
      },
      "finalUrl": {
        "type": [
          "string",
          "null"
        ]
      },
      "title": {
        "type": [
          "string",
          "null"
        ]
      },
      "description": {
        "type": [
          "string",
          "null"
        ]
      },
      "note": {
        "type": [
          "string",
          "null"
        ]
      },
      "siteName": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": "string",
        "enum": [
          "pending",
          "ok",
          "error"
        ]
      },
      "fetchError": {
        "type": [
          "string",
          "null"
        ]
      },
      "fetchedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "hasImage": {
        "type": "boolean"
      },
      "hasFavicon": {
        "type": "boolean"
      },
      "createdBy": {
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
      "boardId",
      "url",
      "finalUrl",
      "title",
      "description",
      "note",
      "siteName",
      "status",
      "fetchError",
      "fetchedAt",
      "hasImage",
      "hasFavicon",
      "createdBy",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `GET /pins/:id` — getPin

Fetches one pin.

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
    "boardId": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "finalUrl": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": [
        "string",
        "null"
      ]
    },
    "description": {
      "type": [
        "string",
        "null"
      ]
    },
    "note": {
      "type": [
        "string",
        "null"
      ]
    },
    "siteName": {
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "pending",
        "ok",
        "error"
      ]
    },
    "fetchError": {
      "type": [
        "string",
        "null"
      ]
    },
    "fetchedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "hasImage": {
      "type": "boolean"
    },
    "hasFavicon": {
      "type": "boolean"
    },
    "createdBy": {
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
    "boardId",
    "url",
    "finalUrl",
    "title",
    "description",
    "note",
    "siteName",
    "status",
    "fetchError",
    "fetchedAt",
    "hasImage",
    "hasFavicon",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `POST /pins` — createPin

Adds a link to a board and immediately fetches its metadata server-side (Open Graph/Twitter Card/meta fallbacks; redirects followed; private IPs refused). The preview image and favicon are downloaded and stored so clients never hotlink. A missing scheme is assumed to be https://. The returned pin carries status ok/error with fetchError detail — the pin is saved either way.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "boardId": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "note": {
      "type": "string"
    }
  },
  "required": [
    "boardId",
    "url"
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
    "boardId": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "finalUrl": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": [
        "string",
        "null"
      ]
    },
    "description": {
      "type": [
        "string",
        "null"
      ]
    },
    "note": {
      "type": [
        "string",
        "null"
      ]
    },
    "siteName": {
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "pending",
        "ok",
        "error"
      ]
    },
    "fetchError": {
      "type": [
        "string",
        "null"
      ]
    },
    "fetchedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "hasImage": {
      "type": "boolean"
    },
    "hasFavicon": {
      "type": "boolean"
    },
    "createdBy": {
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
    "boardId",
    "url",
    "finalUrl",
    "title",
    "description",
    "note",
    "siteName",
    "status",
    "fetchError",
    "fetchedAt",
    "hasImage",
    "hasFavicon",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /pins/:id` — updatePin

Edits a pin: move boards, override title/description, edit the note, or change the URL. Changing the URL re-fetches metadata (overwriting title/description with fresh values).

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
    "boardId": {
      "type": "string"
    },
    "title": {
      "type": [
        "string",
        "null"
      ]
    },
    "description": {
      "type": [
        "string",
        "null"
      ]
    },
    "note": {
      "type": [
        "string",
        "null"
      ]
    },
    "url": {
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
    "boardId": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "finalUrl": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": [
        "string",
        "null"
      ]
    },
    "description": {
      "type": [
        "string",
        "null"
      ]
    },
    "note": {
      "type": [
        "string",
        "null"
      ]
    },
    "siteName": {
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "pending",
        "ok",
        "error"
      ]
    },
    "fetchError": {
      "type": [
        "string",
        "null"
      ]
    },
    "fetchedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "hasImage": {
      "type": "boolean"
    },
    "hasFavicon": {
      "type": "boolean"
    },
    "createdBy": {
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
    "boardId",
    "url",
    "finalUrl",
    "title",
    "description",
    "note",
    "siteName",
    "status",
    "fetchError",
    "fetchedAt",
    "hasImage",
    "hasFavicon",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `POST /pins/:id/refresh` — refreshPin

Re-fetches a pin's metadata from its URL, overwriting title/description/image/favicon with fresh values.

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
    "boardId": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "finalUrl": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": [
        "string",
        "null"
      ]
    },
    "description": {
      "type": [
        "string",
        "null"
      ]
    },
    "note": {
      "type": [
        "string",
        "null"
      ]
    },
    "siteName": {
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "pending",
        "ok",
        "error"
      ]
    },
    "fetchError": {
      "type": [
        "string",
        "null"
      ]
    },
    "fetchedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "hasImage": {
      "type": "boolean"
    },
    "hasFavicon": {
      "type": "boolean"
    },
    "createdBy": {
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
    "boardId",
    "url",
    "finalUrl",
    "title",
    "description",
    "note",
    "siteName",
    "status",
    "fetchError",
    "fetchedAt",
    "hasImage",
    "hasFavicon",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /pins/:id` — deletePin

Removes a pin from its board (stored image/favicon go with it).

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

### `GET /pins/:id/image` — pinImage

Serves the pin's stored preview image bytes (content-type preserved, 24h private cache). 404 when none was fetched.

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
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

### `GET /pins/:id/favicon` — pinFavicon

Serves the pin's stored favicon bytes (content-type preserved, 24h private cache). 404 when none was fetched.

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
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

### `POST /metadata/preview` — previewMetadata

Fetches a URL's metadata WITHOUT saving anything — powers the add-pin dialog's live preview. Images come back as base64 data URIs (byte-capped). 422 with {ok:false, error} when the URL can't be fetched.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "url": {
      "type": "string"
    }
  },
  "required": [
    "url"
  ],
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "anyOf": [
    {
      "type": "object",
      "properties": {
        "ok": {
          "type": "boolean",
          "const": true
        },
        "finalUrl": {
          "type": "string"
        },
        "title": {
          "type": [
            "string",
            "null"
          ]
        },
        "description": {
          "type": [
            "string",
            "null"
          ]
        },
        "siteName": {
          "type": [
            "string",
            "null"
          ]
        },
        "imageDataUri": {
          "type": [
            "string",
            "null"
          ]
        },
        "faviconDataUri": {
          "type": [
            "string",
            "null"
          ]
        }
      },
      "required": [
        "ok",
        "finalUrl",
        "title",
        "description",
        "siteName",
        "imageDataUri",
        "faviconDataUri"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "ok": {
          "type": "boolean",
          "const": false
        },
        "error": {
          "type": "string"
        }
      },
      "required": [
        "ok",
        "error"
      ],
      "additionalProperties": false
    }
  ]
}
```
