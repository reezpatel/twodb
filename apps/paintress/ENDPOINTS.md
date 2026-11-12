# ENDPOINTS.md — Paintress

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Miro-like boards for diagrams (architecture, AWS/GCP, ERD, flowcharts, swimlane process maps) and Markdown+Mermaid docs. A human edits in the browser while LLM agents edit through the REST API; every change shows up live over a WebSocket.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/paintress`
- **Capabilities**: boards, diagrams
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T04:02:56.287Z_

## Endpoints

### `GET /boards` — listBoards

Lists boards in the caller's workspace (optionally one space). Every workspace member can read and write every board.

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
  "type": "object",
  "properties": {
    "boards": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "workspaceId": {
            "type": "string"
          },
          "spaceId": {
            "type": "string"
          },
          "kind": {
            "type": "string",
            "enum": [
              "diagram",
              "doc"
            ]
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "lastSeq": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "docVersion": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "createdBy": {
            "type": "string"
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
          "workspaceId",
          "spaceId",
          "kind",
          "name",
          "description",
          "lastSeq",
          "docVersion",
          "createdBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "boards"
  ],
  "additionalProperties": false
}
```

### `POST /boards` — createBoard

Creates a board. `kind: "diagram"` is a canvas for architecture/AWS/GCP/ERD/flowchart/process diagrams; `kind: "doc"` is a Markdown document whose ```mermaid blocks render as diagrams. `spaceId` defaults to the caller's first space.

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
      "maxLength": 200
    },
    "kind": {
      "default": "diagram",
      "type": "string",
      "enum": [
        "diagram",
        "doc"
      ]
    },
    "description": {
      "type": "string",
      "maxLength": 2000
    },
    "spaceId": {
      "type": "string"
    },
    "markdown": {
      "description": "Initial markdown (doc boards only)",
      "type": "string"
    }
  },
  "required": [
    "name",
    "kind"
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
    "workspaceId": {
      "type": "string"
    },
    "spaceId": {
      "type": "string"
    },
    "kind": {
      "type": "string",
      "enum": [
        "diagram",
        "doc"
      ]
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "lastSeq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "docVersion": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "createdBy": {
      "type": "string"
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
    "workspaceId",
    "spaceId",
    "kind",
    "name",
    "description",
    "lastSeq",
    "docVersion",
    "createdBy",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `GET /boards/:id` — getBoard

Returns a board with its current content: all items (diagram) or the markdown + version (doc), plus `seq` for resuming live events.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
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
    "board": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "workspaceId": {
          "type": "string"
        },
        "spaceId": {
          "type": "string"
        },
        "kind": {
          "type": "string",
          "enum": [
            "diagram",
            "doc"
          ]
        },
        "name": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "lastSeq": {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        "docVersion": {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        "createdBy": {
          "type": "string"
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
        "workspaceId",
        "spaceId",
        "kind",
        "name",
        "description",
        "lastSeq",
        "docVersion",
        "createdBy",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    },
    "items": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "doc": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "markdown": {
              "type": "string"
            },
            "version": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            }
          },
          "required": [
            "markdown",
            "version"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "board",
    "items",
    "doc"
  ],
  "additionalProperties": false
}
```

### `PATCH /boards/:id` — updateBoard

Renames a board or changes its description.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "description": {
      "type": "string",
      "maxLength": 2000
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
    "workspaceId": {
      "type": "string"
    },
    "spaceId": {
      "type": "string"
    },
    "kind": {
      "type": "string",
      "enum": [
        "diagram",
        "doc"
      ]
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "lastSeq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "docVersion": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "createdBy": {
      "type": "string"
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
    "workspaceId",
    "spaceId",
    "kind",
    "name",
    "description",
    "lastSeq",
    "docVersion",
    "createdBy",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /boards/:id` — deleteBoard

Soft-deletes a board.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
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

### `GET /boards/:id/items` — listItems

Lists items of a diagram board. Positions are relative to the parent item (children of groups/lanes move with them). Filter with `type` (shape|group|pool|lane|entity|edge|sticky|text|image) or `parentId`.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "type": {
      "type": "string"
    },
    "parentId": {
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
    "items": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "items"
  ],
  "additionalProperties": false
}
```

### `POST /boards/:id/ops` — applyOps

Applies a batch of create/update/delete ops in ONE transaction = ONE undo step for the human (`label` is shown to them, e.g. "AI: added API gateway"). Deleting an item also deletes its children and attached edges. Returns the new state of touched items and `inverse` ops that revert the batch. Ops that cannot apply (missing id, version conflict, duplicate key) are reported in `skipped` and the rest still apply.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "ops": {
      "minItems": 1,
      "maxItems": 2000,
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "label": {
      "type": "string",
      "maxLength": 200
    },
    "clientId": {
      "type": "string",
      "maxLength": 100
    }
  },
  "required": [
    "id",
    "ops"
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
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "batchId": {
      "type": "string"
    },
    "upserts": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "deletes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "inverse": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "skipped": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "seq",
    "batchId",
    "upserts",
    "deletes",
    "inverse",
    "skipped"
  ],
  "additionalProperties": false
}
```

### `POST /boards/:id/items` — createItems

Convenience wrapper over /ops: creates items. Item `data` depends on `type` — shape {pack,shape,text,icon,…}, group {kind,title,…}, entity {name,columns[]}, edge {from:{itemId,handle?},to:{…},label,kind,cardinality}, sticky {text,color}, text {text}. See GET /catalog for shapes, group kinds and icons.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "items": {
      "minItems": 1,
      "maxItems": 2000,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "default": 0,
            "type": "number"
          },
          "y": {
            "default": 0,
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "data": {
            "default": {},
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          }
        },
        "required": [
          "type",
          "x",
          "y",
          "data"
        ],
        "additionalProperties": false
      }
    },
    "label": {
      "type": "string",
      "maxLength": 200
    }
  },
  "required": [
    "id",
    "items"
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
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "batchId": {
      "type": "string"
    },
    "upserts": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "deletes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "inverse": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "skipped": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "seq",
    "batchId",
    "upserts",
    "deletes",
    "inverse",
    "skipped"
  ],
  "additionalProperties": false
}
```

### `PATCH /boards/:id/items/:itemId` — patchItem

Updates one item. `data` is shallow-merged (a null value removes a key). Pass `ifVersion` to guard against concurrent edits.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "itemId": {
      "type": "string"
    },
    "ifVersion": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "label": {
      "type": "string",
      "maxLength": 200
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "x": {
      "type": "number"
    },
    "y": {
      "type": "number"
    },
    "width": {
      "type": "number"
    },
    "height": {
      "type": "number"
    },
    "zIndex": {
      "type": "number"
    },
    "locked": {
      "type": "boolean"
    },
    "pinned": {
      "type": "boolean"
    },
    "key": {
      "type": [
        "string",
        "null"
      ]
    },
    "data": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    }
  },
  "required": [
    "id",
    "itemId"
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
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "batchId": {
      "type": "string"
    },
    "upserts": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "deletes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "inverse": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "skipped": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "seq",
    "batchId",
    "upserts",
    "deletes",
    "inverse",
    "skipped"
  ],
  "additionalProperties": false
}
```

### `DELETE /boards/:id/items/:itemId` — deleteItem

Deletes one item together with its children and attached edges.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "itemId": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "itemId"
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
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "batchId": {
      "type": "string"
    },
    "upserts": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "deletes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "inverse": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "skipped": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "seq",
    "batchId",
    "upserts",
    "deletes",
    "inverse",
    "skipped"
  ],
  "additionalProperties": false
}
```

### `GET /boards/:id/events` — getEvents

Change log of a board (who changed what, with inverse ops). `since` returns events with seq greater than it. The same events stream live over the WebSocket.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "since": {
      "default": 0,
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "id",
    "since"
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
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "seq": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "boardId": {
            "type": "string"
          },
          "actor": {
            "type": "string"
          },
          "origin": {
            "type": [
              "string",
              "null"
            ]
          },
          "batchId": {
            "type": "string"
          },
          "label": {
            "type": [
              "string",
              "null"
            ]
          },
          "ts": {
            "type": "string"
          },
          "upserts": {
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
                "key": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "type": {
                  "type": "string",
                  "enum": [
                    "shape",
                    "group",
                    "pool",
                    "lane",
                    "entity",
                    "edge",
                    "sticky",
                    "text",
                    "image"
                  ]
                },
                "parentId": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "x": {
                  "type": "number"
                },
                "y": {
                  "type": "number"
                },
                "width": {
                  "type": "number"
                },
                "height": {
                  "type": "number"
                },
                "zIndex": {
                  "type": "number"
                },
                "locked": {
                  "type": "boolean"
                },
                "pinned": {
                  "type": "boolean"
                },
                "version": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991
                },
                "data": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {}
                },
                "createdBy": {
                  "type": "string"
                },
                "updatedBy": {
                  "type": "string"
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
                "boardId",
                "key",
                "type",
                "parentId",
                "x",
                "y",
                "width",
                "height",
                "zIndex",
                "locked",
                "pinned",
                "version",
                "data",
                "createdBy",
                "updatedBy",
                "createdAt",
                "updatedAt"
              ],
              "additionalProperties": false
            }
          },
          "deletes": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "inverse": {
            "type": "array",
            "items": {
              "oneOf": [
                {
                  "type": "object",
                  "properties": {
                    "op": {
                      "type": "string",
                      "const": "create"
                    },
                    "item": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string"
                        },
                        "key": {
                          "type": [
                            "string",
                            "null"
                          ]
                        },
                        "type": {
                          "type": "string",
                          "enum": [
                            "shape",
                            "group",
                            "pool",
                            "lane",
                            "entity",
                            "edge",
                            "sticky",
                            "text",
                            "image"
                          ]
                        },
                        "parentId": {
                          "type": [
                            "string",
                            "null"
                          ]
                        },
                        "x": {
                          "default": 0,
                          "type": "number"
                        },
                        "y": {
                          "default": 0,
                          "type": "number"
                        },
                        "width": {
                          "type": "number"
                        },
                        "height": {
                          "type": "number"
                        },
                        "zIndex": {
                          "type": "number"
                        },
                        "locked": {
                          "type": "boolean"
                        },
                        "pinned": {
                          "type": "boolean"
                        },
                        "data": {
                          "default": {},
                          "type": "object",
                          "propertyNames": {
                            "type": "string"
                          },
                          "additionalProperties": {}
                        }
                      },
                      "required": [
                        "type",
                        "x",
                        "y",
                        "data"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "op",
                    "item"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "op": {
                      "type": "string",
                      "const": "update"
                    },
                    "id": {
                      "type": "string"
                    },
                    "patch": {
                      "type": "object",
                      "properties": {
                        "parentId": {
                          "type": [
                            "string",
                            "null"
                          ]
                        },
                        "x": {
                          "type": "number"
                        },
                        "y": {
                          "type": "number"
                        },
                        "width": {
                          "type": "number"
                        },
                        "height": {
                          "type": "number"
                        },
                        "zIndex": {
                          "type": "number"
                        },
                        "locked": {
                          "type": "boolean"
                        },
                        "pinned": {
                          "type": "boolean"
                        },
                        "key": {
                          "type": [
                            "string",
                            "null"
                          ]
                        },
                        "data": {
                          "type": "object",
                          "propertyNames": {
                            "type": "string"
                          },
                          "additionalProperties": {}
                        }
                      },
                      "additionalProperties": false
                    },
                    "ifVersion": {
                      "type": "integer",
                      "minimum": -9007199254740991,
                      "maximum": 9007199254740991
                    }
                  },
                  "required": [
                    "op",
                    "id",
                    "patch"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "op": {
                      "type": "string",
                      "const": "delete"
                    },
                    "id": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "op",
                    "id"
                  ],
                  "additionalProperties": false
                }
              ]
            }
          },
          "doc": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "markdown": {
                    "type": "string"
                  },
                  "version": {
                    "type": "integer",
                    "minimum": -9007199254740991,
                    "maximum": 9007199254740991
                  }
                },
                "required": [
                  "markdown",
                  "version"
                ],
                "additionalProperties": false
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "seq",
          "boardId",
          "actor",
          "origin",
          "batchId",
          "label",
          "ts",
          "upserts",
          "deletes",
          "inverse",
          "doc"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "events"
  ],
  "additionalProperties": false
}
```

### `POST /boards/:id/events/:seq/undo` — undoBatch

Reverts one past batch by applying its stored inverse ops (itself a new, undoable batch). Items edited since may make parts of the undo `skipped`.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "id",
    "seq"
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
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "batchId": {
      "type": "string"
    },
    "upserts": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "deletes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "inverse": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "skipped": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "seq",
    "batchId",
    "upserts",
    "deletes",
    "inverse",
    "skipped"
  ],
  "additionalProperties": false
}
```

### `POST /boards/:id/diagram` — buildDiagram

PRIMARY AGENT ENDPOINT for architecture, cloud (AWS/GCP), C4 and flowchart diagrams. Describe the graph — nested `groups` (style ids like aws-cloud, aws-vpc, aws-subnet-private, gcp-project, boundary), `nodes` (label, icon id or phrase, shape) and `edges` (label, step, kind sync|async|data) — and the server computes positions (ELK layered layout, orthogonal edges, nested containers). Items are matched by `key`, so calling again with mode=merge updates/extends the diagram without disturbing parts the human moved by hand. mode=replace wipes the board first.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "mode": {
      "default": "merge",
      "description": "merge: create or update items by key. replace: wipe the board first.",
      "type": "string",
      "enum": [
        "merge",
        "replace"
      ]
    },
    "direction": {
      "default": "LR",
      "type": "string",
      "enum": [
        "LR",
        "TB",
        "RL",
        "BT"
      ]
    },
    "label": {
      "description": "Undo-step label shown to the human",
      "type": "string",
      "maxLength": 200
    },
    "relayout": {
      "description": "Also move items the human has positioned by hand",
      "type": "boolean"
    },
    "origin": {
      "type": "object",
      "properties": {
        "x": {
          "type": "number"
        },
        "y": {
          "type": "number"
        }
      },
      "required": [
        "x",
        "y"
      ],
      "additionalProperties": false
    },
    "groups": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "title": {
            "default": "",
            "type": "string"
          },
          "style": {
            "description": "Group style id, e.g. \"aws-vpc\", \"aws-subnet-private\", \"gcp-project\", \"boundary\", \"plain\"",
            "type": "string"
          },
          "parent": {
            "description": "Key of the enclosing group",
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "icon": {
            "type": "string"
          }
        },
        "required": [
          "key",
          "title"
        ],
        "additionalProperties": false
      }
    },
    "nodes": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "label": {
            "type": "string"
          },
          "sublabel": {
            "type": "string"
          },
          "shape": {
            "description": "Shape id, e.g. \"rounded\", \"cylinder\", \"decision\", \"terminator\", \"person\"",
            "type": "string"
          },
          "pack": {
            "type": "string"
          },
          "icon": {
            "description": "Icon id (\"logos:aws-lambda\") or a phrase (\"aws lambda\") that is resolved for you",
            "type": "string"
          },
          "parent": {
            "description": "Key of the enclosing group",
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "fill": {
            "type": "string"
          },
          "stroke": {
            "type": "string"
          }
        },
        "required": [
          "key",
          "label"
        ],
        "additionalProperties": false
      }
    },
    "edges": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "from": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "to": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "label": {
            "type": "string"
          },
          "step": {
            "description": "Numbered badge for data-flow order",
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "kind": {
            "type": "string",
            "enum": [
              "flow",
              "sync",
              "async",
              "data",
              "dep",
              "relation"
            ]
          },
          "routing": {
            "type": "string",
            "enum": [
              "orthogonal",
              "straight",
              "bezier"
            ]
          },
          "dashed": {
            "type": "boolean"
          },
          "bidirectional": {
            "type": "boolean"
          }
        },
        "required": [
          "from",
          "to"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "id",
    "mode",
    "direction",
    "groups",
    "nodes",
    "edges"
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
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "batchId": {
      "type": "string"
    },
    "keyToId": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "created": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "updated": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "deleted": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "items": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "inverse": {
      "description": "Ops that revert this batch (what the human's Undo applies)",
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    }
  },
  "required": [
    "seq",
    "batchId",
    "keyToId",
    "created",
    "updated",
    "deleted",
    "warnings"
  ],
  "additionalProperties": false
}
```

### `POST /boards/:id/erd` — buildErd

Builds an entity-relationship diagram: `entities` with typed `columns` (pk, fk:"entity.column", nullable, unique). Relations are derived from column `fk`s (crow's-foot cardinality inferred from nullable/unique) and can be added explicitly. Each column is its own connection point, so relation lines attach to the exact row.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "mode": {
      "default": "merge",
      "description": "merge: create or update items by key. replace: wipe the board first.",
      "type": "string",
      "enum": [
        "merge",
        "replace"
      ]
    },
    "direction": {
      "default": "LR",
      "type": "string",
      "enum": [
        "LR",
        "TB",
        "RL",
        "BT"
      ]
    },
    "label": {
      "type": "string",
      "maxLength": 200
    },
    "relayout": {
      "type": "boolean"
    },
    "origin": {
      "type": "object",
      "properties": {
        "x": {
          "type": "number"
        },
        "y": {
          "type": "number"
        }
      },
      "required": [
        "x",
        "y"
      ],
      "additionalProperties": false
    },
    "entities": {
      "minItems": 1,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "name": {
            "type": "string"
          },
          "columns": {
            "default": [],
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string"
                },
                "type": {
                  "default": "",
                  "type": "string"
                },
                "pk": {
                  "type": "boolean"
                },
                "fk": {
                  "description": "\"entityKey.columnName\" this column references",
                  "type": "string"
                },
                "nullable": {
                  "type": "boolean"
                },
                "unique": {
                  "type": "boolean"
                }
              },
              "required": [
                "name",
                "type"
              ],
              "additionalProperties": false
            }
          },
          "color": {
            "type": "string"
          }
        },
        "required": [
          "key",
          "columns"
        ],
        "additionalProperties": false
      }
    },
    "relations": {
      "default": [],
      "description": "Extra relations; column `fk` references are turned into relations automatically",
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "description": "\"entityKey.column\" (the many / referencing side)"
          },
          "to": {
            "type": "string",
            "description": "\"entityKey.column\" (the one / referenced side)"
          },
          "label": {
            "type": "string"
          },
          "cardinality": {
            "type": "object",
            "properties": {
              "from": {
                "type": "string",
                "enum": [
                  "one",
                  "zero_or_one",
                  "many",
                  "zero_or_many",
                  "one_or_many"
                ]
              },
              "to": {
                "type": "string",
                "enum": [
                  "one",
                  "zero_or_one",
                  "many",
                  "zero_or_many",
                  "one_or_many"
                ]
              }
            },
            "additionalProperties": false
          }
        },
        "required": [
          "from",
          "to"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "id",
    "mode",
    "direction",
    "entities",
    "relations"
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
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "batchId": {
      "type": "string"
    },
    "keyToId": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "created": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "updated": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "deleted": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "items": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "inverse": {
      "description": "Ops that revert this batch (what the human's Undo applies)",
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    }
  },
  "required": [
    "seq",
    "batchId",
    "keyToId",
    "created",
    "updated",
    "deleted",
    "warnings"
  ],
  "additionalProperties": false
}
```

### `POST /boards/:id/process` — buildProcess

Builds a swimlane process map: `lanes`, `steps` (each in a lane, with a flowchart/BPMN shape such as process, decision, terminator, task, start-event, gateway-exclusive) and `flows` between steps. Steps are layered left→right in flow order, inside their lane.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "mode": {
      "default": "merge",
      "description": "merge: create or update items by key. replace: wipe the board first.",
      "type": "string",
      "enum": [
        "merge",
        "replace"
      ]
    },
    "label": {
      "type": "string",
      "maxLength": 200
    },
    "origin": {
      "type": "object",
      "properties": {
        "x": {
          "type": "number"
        },
        "y": {
          "type": "number"
        }
      },
      "required": [
        "x",
        "y"
      ],
      "additionalProperties": false
    },
    "title": {
      "default": "",
      "description": "Pool title",
      "type": "string"
    },
    "lanes": {
      "minItems": 1,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "title": {
            "type": "string"
          }
        },
        "required": [
          "key",
          "title"
        ],
        "additionalProperties": false
      }
    },
    "steps": {
      "minItems": 1,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "lane": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "label": {
            "type": "string"
          },
          "shape": {
            "default": "process",
            "description": "Flowchart or BPMN shape id: process, decision, terminator, task, start-event, end-event, gateway-exclusive, …",
            "type": "string"
          },
          "pack": {
            "type": "string"
          }
        },
        "required": [
          "key",
          "lane",
          "label",
          "shape"
        ],
        "additionalProperties": false
      }
    },
    "flows": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "to": {
            "type": "string",
            "minLength": 1,
            "maxLength": 100
          },
          "label": {
            "type": "string"
          }
        },
        "required": [
          "from",
          "to"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "id",
    "mode",
    "title",
    "lanes",
    "steps",
    "flows"
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
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "batchId": {
      "type": "string"
    },
    "keyToId": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "created": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "updated": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "deleted": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "items": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "inverse": {
      "description": "Ops that revert this batch (what the human's Undo applies)",
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    }
  },
  "required": [
    "seq",
    "batchId",
    "keyToId",
    "created",
    "updated",
    "deleted",
    "warnings"
  ],
  "additionalProperties": false
}
```

### `POST /boards/:id/mermaid` — importMermaid

Imports Mermaid source as native, editable items. Supported: `flowchart`/`graph` (shapes, subgraphs, edge labels, dashed/bidirectional links) and `erDiagram`. Other Mermaid types are rejected — use /diagram, or write them into a doc board where ```mermaid blocks render as-is.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "source": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100000
    },
    "mode": {
      "default": "merge",
      "description": "merge: create or update items by key. replace: wipe the board first.",
      "type": "string",
      "enum": [
        "merge",
        "replace"
      ]
    },
    "direction": {
      "type": "string",
      "enum": [
        "LR",
        "TB",
        "RL",
        "BT"
      ]
    },
    "label": {
      "type": "string",
      "maxLength": 200
    },
    "origin": {
      "type": "object",
      "properties": {
        "x": {
          "type": "number"
        },
        "y": {
          "type": "number"
        }
      },
      "required": [
        "x",
        "y"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "id",
    "source",
    "mode"
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
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "batchId": {
      "type": "string"
    },
    "keyToId": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "created": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "updated": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "deleted": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "items": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "inverse": {
      "description": "Ops that revert this batch (what the human's Undo applies)",
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    }
  },
  "required": [
    "seq",
    "batchId",
    "keyToId",
    "created",
    "updated",
    "deleted",
    "warnings"
  ],
  "additionalProperties": false
}
```

### `POST /boards/:id/layout` — relayout

Tidy up: re-runs auto-layout over the whole board, or over the children of `groupId`. Hand-placed (pinned) items are kept unless `includePinned`. Swimlane pools are left alone.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "direction": {
      "default": "LR",
      "type": "string",
      "enum": [
        "LR",
        "TB",
        "RL",
        "BT"
      ]
    },
    "groupId": {
      "description": "Only re-layout the children of this group",
      "type": "string"
    },
    "includePinned": {
      "default": false,
      "type": "boolean"
    },
    "label": {
      "type": "string",
      "maxLength": 200
    }
  },
  "required": [
    "id",
    "direction",
    "includePinned"
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
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "batchId": {
      "type": "string"
    },
    "keyToId": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "created": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "updated": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "deleted": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "items": {
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
          "key": {
            "type": [
              "string",
              "null"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "shape",
              "group",
              "pool",
              "lane",
              "entity",
              "edge",
              "sticky",
              "text",
              "image"
            ]
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "x": {
            "type": "number"
          },
          "y": {
            "type": "number"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          },
          "zIndex": {
            "type": "number"
          },
          "locked": {
            "type": "boolean"
          },
          "pinned": {
            "type": "boolean"
          },
          "version": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991
          },
          "data": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "createdBy": {
            "type": "string"
          },
          "updatedBy": {
            "type": "string"
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
          "boardId",
          "key",
          "type",
          "parentId",
          "x",
          "y",
          "width",
          "height",
          "zIndex",
          "locked",
          "pinned",
          "version",
          "data",
          "createdBy",
          "updatedBy",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "inverse": {
      "description": "Ops that revert this batch (what the human's Undo applies)",
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "create"
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "type": {
                    "type": "string",
                    "enum": [
                      "shape",
                      "group",
                      "pool",
                      "lane",
                      "entity",
                      "edge",
                      "sticky",
                      "text",
                      "image"
                    ]
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "default": 0,
                    "type": "number"
                  },
                  "y": {
                    "default": 0,
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "data": {
                    "default": {},
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "x",
                  "y",
                  "data"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "op",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "update"
              },
              "id": {
                "type": "string"
              },
              "patch": {
                "type": "object",
                "properties": {
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "x": {
                    "type": "number"
                  },
                  "y": {
                    "type": "number"
                  },
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  },
                  "zIndex": {
                    "type": "number"
                  },
                  "locked": {
                    "type": "boolean"
                  },
                  "pinned": {
                    "type": "boolean"
                  },
                  "key": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "data": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "additionalProperties": false
              },
              "ifVersion": {
                "type": "integer",
                "minimum": -9007199254740991,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "op",
              "id",
              "patch"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "delete"
              },
              "id": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "id"
            ],
            "additionalProperties": false
          }
        ]
      }
    }
  },
  "required": [
    "seq",
    "batchId",
    "keyToId",
    "created",
    "updated",
    "deleted",
    "warnings"
  ],
  "additionalProperties": false
}
```

### `GET /boards/:id/describe` — describeBoard

Compact text outline of a board — groups as a tree, nodes with icons, ERD tables, lanes and connections written as `a --label--> b` — so an agent can read back what is there. Doc boards return their markdown.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
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
    "text": {
      "type": "string"
    },
    "counts": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "number"
      }
    },
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "text",
    "counts",
    "seq"
  ],
  "additionalProperties": false
}
```

### `GET /boards/:id/doc` — getDoc

Returns a doc board's markdown and version.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
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
    "markdown": {
      "type": "string"
    },
    "version": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "markdown",
    "version"
  ],
  "additionalProperties": false
}
```

### `PUT /boards/:id/doc` — putDoc

Replaces a doc board's markdown. Pass `ifVersion` to fail with 409 if someone edited since you read it.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "markdown": {
      "type": "string",
      "maxLength": 2000000
    },
    "ifVersion": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "label": {
      "type": "string",
      "maxLength": 200
    }
  },
  "required": [
    "id",
    "markdown"
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
    "version": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "version",
    "seq"
  ],
  "additionalProperties": false
}
```

### `PATCH /boards/:id/doc` — patchDoc

Edits a doc board in place without resending it: `append`/`prepend`, `replace_section` (by heading text; replaces everything up to the next heading of the same or higher level) or `replace` (find → with). Ops apply in order, atomically.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
    },
    "ops": {
      "minItems": 1,
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "append"
              },
              "markdown": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "markdown"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "prepend"
              },
              "markdown": {
                "type": "string"
              }
            },
            "required": [
              "op",
              "markdown"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "replace_section"
              },
              "heading": {
                "type": "string",
                "description": "Heading text (without #)"
              },
              "markdown": {
                "type": "string",
                "description": "New section body; the heading line is kept"
              }
            },
            "required": [
              "op",
              "heading",
              "markdown"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "op": {
                "type": "string",
                "const": "replace"
              },
              "find": {
                "type": "string"
              },
              "with": {
                "type": "string"
              },
              "all": {
                "type": "boolean"
              }
            },
            "required": [
              "op",
              "find",
              "with"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "ifVersion": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "label": {
      "type": "string",
      "maxLength": 200
    }
  },
  "required": [
    "id",
    "ops"
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
    "version": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "seq": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "markdown": {
      "type": "string"
    }
  },
  "required": [
    "version",
    "seq",
    "markdown"
  ],
  "additionalProperties": false
}
```

### `GET /icons/search` — searchIcons

Searches the bundled icon sets: `logos` (tech brands + AWS services, e.g. logos:aws-lambda), `gcp` (Google Cloud products, e.g. gcp:bigquery), `carbon` (generic infrastructure) and `mdi`. Use the returned `id` as a node's `icon`.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "q": {
      "type": "string"
    },
    "set": {
      "type": "string",
      "enum": [
        "logos",
        "gcp",
        "carbon",
        "mdi"
      ]
    },
    "limit": {
      "default": 20,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [
    "q",
    "limit"
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
    "icons": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "set": {
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "set",
          "name"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "icons"
  ],
  "additionalProperties": false
}
```

### `GET /icons/:set/:name` — getIcon

Serves one icon as an SVG image (`image/svg+xml`). Optional `color` recolours monochrome icons.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "set": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "color": {
      "type": "string"
    }
  },
  "required": [
    "set",
    "name"
  ],
  "additionalProperties": false
}
```

### `GET /catalog` — getCatalog

Everything a client needs to build diagrams: shape packs and shape ids, group styles (AWS/GCP/C4), edge kinds, cardinalities and icon sets.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "shapes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pack": {
            "type": "string"
          },
          "id": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "width": {
            "type": "number"
          },
          "height": {
            "type": "number"
          }
        },
        "required": [
          "pack",
          "id",
          "label",
          "width",
          "height"
        ],
        "additionalProperties": false
      }
    },
    "groupStyles": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "pack": {
            "type": "string"
          },
          "label": {
            "type": "string"
          },
          "stroke": {
            "type": "string"
          },
          "fill": {
            "type": "string"
          },
          "dashed": {
            "type": "boolean"
          },
          "icon": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "pack",
          "label",
          "stroke",
          "fill"
        ],
        "additionalProperties": false
      }
    },
    "edgeKinds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "cardinalities": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "iconSets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "prefix": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "license": {
            "type": "string"
          }
        },
        "required": [
          "prefix",
          "name",
          "license"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "shapes",
    "groupStyles",
    "edgeKinds",
    "cardinalities",
    "iconSets"
  ],
  "additionalProperties": false
}
```

### `POST /boards/:id/assets` — uploadAsset

Uploads an image (multipart/form-data, field `file`, png/jpeg/gif/webp/svg, ≤10 MB) to the board's S3 folder (paintress/{workspaceId}/{boardId}/{assetId}). Place it with an `image` item {assetId}.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Board id"
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
    "contentType": {
      "type": "string"
    },
    "size": {
      "type": "number"
    },
    "name": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "contentType",
    "size",
    "name"
  ],
  "additionalProperties": false
}
```

### `GET /assets/:assetId` — getAsset

Serves an uploaded image (workspace-checked). Streams the bytes.

- **Auth**: `session-or-apiKey`
- **Streaming**: yes (chunked/SSE response)

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "assetId": {
      "type": "string"
    }
  },
  "required": [
    "assetId"
  ],
  "additionalProperties": false
}
```
