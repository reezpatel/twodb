# ENDPOINTS.md — TwoPin

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Pinterest-style link boards: save URLs to boards; metadata (title, description, preview image, favicon) is fetched and stored server-side. See AGENTS.md.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twopin/api`
- **Capabilities**: boards, pins, bookmarks, link-metadata
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-28T18:38:27.997Z_

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

Lists pins in the workspace, newest first; pass `?boardId=` to scope to one board and `?tag=` to filter by a tag. Binary assets are never inlined — use hasImage/hasFavicon/hasMedia with the /pins/:id/{image,favicon,media} endpoints.

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
    "tag": {
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
        "type": [
          "string",
          "null"
        ]
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
      "hasMedia": {
        "type": "boolean"
      },
      "mediaContentType": {
        "type": [
          "string",
          "null"
        ]
      },
      "heroKind": {
        "anyOf": [
          {
            "type": "string",
            "enum": [
              "image",
              "video"
            ]
          },
          {
            "type": "null"
          }
        ]
      },
      "heroContentType": {
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
      "hasMedia",
      "mediaContentType",
      "heroKind",
      "heroContentType",
      "tags",
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
      "type": [
        "string",
        "null"
      ]
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
    "hasMedia": {
      "type": "boolean"
    },
    "mediaContentType": {
      "type": [
        "string",
        "null"
      ]
    },
    "heroKind": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "image",
            "video"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "heroContentType": {
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
    "hasMedia",
    "mediaContentType",
    "heroKind",
    "heroContentType",
    "tags",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `GET /tags` — listTags

Lists distinct pin tags in the workspace with counts, most-used first (for filter chips / suggestions).

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "tag": {
        "type": "string"
      },
      "count": {
        "type": "number"
      }
    },
    "required": [
      "tag",
      "count"
    ],
    "additionalProperties": false
  }
}
```

### `POST /pins` — createPin

Adds a pin to a board. Provide `url` to fetch its metadata server-side (Open Graph/Twitter Card/meta fallbacks; redirects followed; private IPs refused; the preview image and favicon are downloaded and stored so clients never hotlink), OR provide `mediaBase64` (image/* or video/*) for a direct media pin with no source link. Provide both to attach media to a link. A missing scheme is assumed to be https://.

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
      "type": [
        "string",
        "null"
      ]
    },
    "note": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "mediaBase64": {
      "type": "string"
    },
    "mediaContentType": {
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
    "boardId"
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
      "type": [
        "string",
        "null"
      ]
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
    "hasMedia": {
      "type": "boolean"
    },
    "mediaContentType": {
      "type": [
        "string",
        "null"
      ]
    },
    "heroKind": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "image",
            "video"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "heroContentType": {
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
    "hasMedia",
    "mediaContentType",
    "heroKind",
    "heroContentType",
    "tags",
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
    },
    "tags": {
      "type": "array",
      "items": {
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
    "id": {
      "type": "string"
    },
    "boardId": {
      "type": "string"
    },
    "url": {
      "type": [
        "string",
        "null"
      ]
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
    "hasMedia": {
      "type": "boolean"
    },
    "mediaContentType": {
      "type": [
        "string",
        "null"
      ]
    },
    "heroKind": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "image",
            "video"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "heroContentType": {
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
    "hasMedia",
    "mediaContentType",
    "heroKind",
    "heroContentType",
    "tags",
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
      "type": [
        "string",
        "null"
      ]
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
    "hasMedia": {
      "type": "boolean"
    },
    "mediaContentType": {
      "type": [
        "string",
        "null"
      ]
    },
    "heroKind": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "image",
            "video"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "heroContentType": {
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
    "hasMedia",
    "mediaContentType",
    "heroKind",
    "heroContentType",
    "tags",
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

### `GET /pins/:id/media` — pinMedia

Serves the pin's directly-uploaded media bytes (image or video, content-type preserved, 24h private cache). 404 when none.

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

### `POST /pins/:id/media` — uploadPinMedia

Uploads or replaces a pin's media (image/* or video/*), base64 JSON body.

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
    "mediaBase64": {
      "type": "string"
    },
    "mediaContentType": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "mediaBase64"
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
      "type": [
        "string",
        "null"
      ]
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
    "hasMedia": {
      "type": "boolean"
    },
    "mediaContentType": {
      "type": [
        "string",
        "null"
      ]
    },
    "heroKind": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "image",
            "video"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "heroContentType": {
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
    "hasMedia",
    "mediaContentType",
    "heroKind",
    "heroContentType",
    "tags",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
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

### `GET /bookmark-folders` — listBookmarkFolders

Lists the caller's workspace bookmark folders with bookmark counts, oldest first.

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
      "parentId": {
        "type": [
          "string",
          "null"
        ]
      },
      "bookmarkCount": {
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
      "name",
      "parentId",
      "bookmarkCount",
      "createdBy",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /bookmark-folders` — createBookmarkFolder

Creates a bookmark folder; pass `parentId` to nest it under another folder.

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
    "parentId": {
      "type": [
        "string",
        "null"
      ]
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
    "name": {
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "bookmarkCount": {
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
    "name",
    "parentId",
    "bookmarkCount",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /bookmark-folders/:id` — updateBookmarkFolder

Renames a bookmark folder or moves it under another folder (`parentId`, null = top level).

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
    "parentId": {
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
    "name": {
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "bookmarkCount": {
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
    "name",
    "parentId",
    "bookmarkCount",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /bookmark-folders/:id` — deleteBookmarkFolder

Deletes a bookmark folder and all its bookmarks (cascade).

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

### `GET /bookmarks` — listBookmarks

Lists bookmarks, newest first. Pass `?folderId=<id>` for one folder or `?folderId=unfiled` for folderless bookmarks. Binary favicons are never inlined — use hasFavicon with /bookmarks/:id/favicon.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "folderId": {
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
      "folderId": {
        "type": [
          "string",
          "null"
        ]
      },
      "url": {
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
      "folderId",
      "url",
      "title",
      "description",
      "hasFavicon",
      "createdBy",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /bookmarks` — createBookmark

Saves a bookmark. Metadata (title, description, favicon) is fetched server-side best-effort; a missing scheme is assumed to be https://. `folderId` is optional (null = unfiled).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "folderId": {
      "type": [
        "string",
        "null"
      ]
    },
    "url": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "description": {
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
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "folderId": {
      "type": [
        "string",
        "null"
      ]
    },
    "url": {
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
    "folderId",
    "url",
    "title",
    "description",
    "hasFavicon",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /bookmarks/:id` — updateBookmark

Edits a bookmark: move folders, override title/description, or change the URL (re-fetches the favicon).

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
    "folderId": {
      "type": [
        "string",
        "null"
      ]
    },
    "url": {
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
    "folderId": {
      "type": [
        "string",
        "null"
      ]
    },
    "url": {
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
    "folderId",
    "url",
    "title",
    "description",
    "hasFavicon",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /bookmarks/:id` — deleteBookmark

Removes a bookmark.

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

### `GET /bookmarks/:id/favicon` — bookmarkFavicon

Serves the bookmark's stored favicon bytes (content-type preserved, 24h private cache). 404 when none was fetched.

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

### `GET /settings` — getSettings

Returns the workspace's TwoPin settings (currently just the default board for the PWA share target).

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "defaultBoardId": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "defaultBoardId"
  ],
  "additionalProperties": false
}
```

### `PATCH /settings` — updateSettings

Sets the workspace's TwoPin settings. `defaultBoardId` is the board shared links land in.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "defaultBoardId": {
      "type": [
        "string",
        "null"
      ]
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
    "defaultBoardId": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "defaultBoardId"
  ],
  "additionalProperties": false
}
```

### `POST /share-save` — shareSave

Saves a shared URL straight into the workspace's configured default board (this is what the PWA share target posts to). Metadata is fetched server-side. Falls back to the first board, or a lazily-created 'Shared' board.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "url": {
      "type": "string"
    },
    "note": {
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
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "boardId": {
      "type": "string"
    },
    "url": {
      "type": [
        "string",
        "null"
      ]
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
    "hasMedia": {
      "type": "boolean"
    },
    "mediaContentType": {
      "type": [
        "string",
        "null"
      ]
    },
    "heroKind": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "image",
            "video"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "heroContentType": {
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
    "hasMedia",
    "mediaContentType",
    "heroKind",
    "heroContentType",
    "tags",
    "createdBy",
    "createdAt"
  ],
  "additionalProperties": false
}
```
