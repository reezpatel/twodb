# ENDPOINTS.md — TwoThing

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Personal inventory: nested places (room › shelf › box), items with specs/images/stock levels, bulk-printed random QR label codes, and camera scanning for labels and manufacturer barcodes.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twothing`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T15:54:57.793Z_

## Endpoints

### `GET /items` — listItems

Search/filter items. `q` matches every term across name, label, specs, tags, part number and barcodes. `locationId` includes sub-places unless recursive=false.

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
    "category": {
      "type": "string"
    },
    "locationId": {
      "type": "string"
    },
    "recursive": {
      "type": "string"
    },
    "tag": {
      "type": "string"
    },
    "low": {
      "type": "string"
    },
    "unplaced": {
      "type": "string"
    },
    "favorite": {
      "type": "string"
    },
    "sort": {
      "type": "string",
      "enum": [
        "name",
        "updated",
        "created",
        "quantity"
      ]
    },
    "limit": {
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
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "code": {
            "description": "Our printed label code (canonical, e.g. K7QM2X)",
            "type": [
              "string",
              "null"
            ]
          },
          "codeDisplay": {
            "description": "Display form, e.g. K7Q-M2X",
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "category": {
            "type": "string"
          },
          "quantity": {
            "type": "number"
          },
          "unit": {
            "type": "string"
          },
          "minQuantity": {
            "type": [
              "number",
              "null"
            ]
          },
          "low": {
            "type": "boolean"
          },
          "locationId": {
            "type": [
              "string",
              "null"
            ]
          },
          "locationPath": {
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
                  "type": "string"
                }
              },
              "required": [
                "id",
                "name",
                "kind"
              ],
              "additionalProperties": false
            }
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "barcodes": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Manufacturer EAN/UPC/QR payloads found on the product"
          },
          "specs": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "string"
            }
          },
          "imageIds": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "mpn": {
            "type": "string"
          },
          "manufacturer": {
            "type": "string"
          },
          "supplier": {
            "type": "string"
          },
          "unitCost": {
            "type": [
              "number",
              "null"
            ]
          },
          "purchaseUrl": {
            "type": "string"
          },
          "datasheetUrl": {
            "type": "string"
          },
          "notes": {
            "type": "string"
          },
          "favorite": {
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
          "code",
          "codeDisplay",
          "name",
          "description",
          "category",
          "quantity",
          "unit",
          "minQuantity",
          "low",
          "locationId",
          "locationPath",
          "tags",
          "barcodes",
          "specs",
          "imageIds",
          "mpn",
          "manufacturer",
          "supplier",
          "unitCost",
          "purchaseUrl",
          "datasheetUrl",
          "notes",
          "favorite",
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

### `POST /items` — createItem

Creates an item. 409 code_in_use if the label is already on something.

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
    "category": {
      "type": "string"
    },
    "quantity": {
      "type": "number"
    },
    "unit": {
      "type": "string"
    },
    "minQuantity": {
      "type": [
        "number",
        "null"
      ]
    },
    "locationId": {
      "type": [
        "string",
        "null"
      ]
    },
    "code": {
      "description": "Label code (scanned/typed); must not be on another item or place",
      "type": [
        "string",
        "null"
      ]
    },
    "autoCode": {
      "description": "Allocate a fresh pool code when `code` is empty",
      "type": "boolean"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "barcodes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "specs": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "imageIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "mpn": {
      "type": "string"
    },
    "manufacturer": {
      "type": "string"
    },
    "supplier": {
      "type": "string"
    },
    "unitCost": {
      "type": [
        "number",
        "null"
      ]
    },
    "purchaseUrl": {
      "type": "string"
    },
    "datasheetUrl": {
      "type": "string"
    },
    "notes": {
      "type": "string"
    },
    "favorite": {
      "type": "boolean"
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
    "code": {
      "description": "Our printed label code (canonical, e.g. K7QM2X)",
      "type": [
        "string",
        "null"
      ]
    },
    "codeDisplay": {
      "description": "Display form, e.g. K7Q-M2X",
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "category": {
      "type": "string"
    },
    "quantity": {
      "type": "number"
    },
    "unit": {
      "type": "string"
    },
    "minQuantity": {
      "type": [
        "number",
        "null"
      ]
    },
    "low": {
      "type": "boolean"
    },
    "locationId": {
      "type": [
        "string",
        "null"
      ]
    },
    "locationPath": {
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
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "kind"
        ],
        "additionalProperties": false
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "barcodes": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Manufacturer EAN/UPC/QR payloads found on the product"
    },
    "specs": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "imageIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "mpn": {
      "type": "string"
    },
    "manufacturer": {
      "type": "string"
    },
    "supplier": {
      "type": "string"
    },
    "unitCost": {
      "type": [
        "number",
        "null"
      ]
    },
    "purchaseUrl": {
      "type": "string"
    },
    "datasheetUrl": {
      "type": "string"
    },
    "notes": {
      "type": "string"
    },
    "favorite": {
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
    "code",
    "codeDisplay",
    "name",
    "description",
    "category",
    "quantity",
    "unit",
    "minQuantity",
    "low",
    "locationId",
    "locationPath",
    "tags",
    "barcodes",
    "specs",
    "imageIds",
    "mpn",
    "manufacturer",
    "supplier",
    "unitCost",
    "purchaseUrl",
    "datasheetUrl",
    "notes",
    "favorite",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `GET /items/:id` — getItem

One item plus its recent activity.

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
    "item": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "code": {
          "description": "Our printed label code (canonical, e.g. K7QM2X)",
          "type": [
            "string",
            "null"
          ]
        },
        "codeDisplay": {
          "description": "Display form, e.g. K7Q-M2X",
          "type": [
            "string",
            "null"
          ]
        },
        "name": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "category": {
          "type": "string"
        },
        "quantity": {
          "type": "number"
        },
        "unit": {
          "type": "string"
        },
        "minQuantity": {
          "type": [
            "number",
            "null"
          ]
        },
        "low": {
          "type": "boolean"
        },
        "locationId": {
          "type": [
            "string",
            "null"
          ]
        },
        "locationPath": {
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
                "type": "string"
              }
            },
            "required": [
              "id",
              "name",
              "kind"
            ],
            "additionalProperties": false
          }
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "barcodes": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Manufacturer EAN/UPC/QR payloads found on the product"
        },
        "specs": {
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "string"
          }
        },
        "imageIds": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "mpn": {
          "type": "string"
        },
        "manufacturer": {
          "type": "string"
        },
        "supplier": {
          "type": "string"
        },
        "unitCost": {
          "type": [
            "number",
            "null"
          ]
        },
        "purchaseUrl": {
          "type": "string"
        },
        "datasheetUrl": {
          "type": "string"
        },
        "notes": {
          "type": "string"
        },
        "favorite": {
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
        "code",
        "codeDisplay",
        "name",
        "description",
        "category",
        "quantity",
        "unit",
        "minQuantity",
        "low",
        "locationId",
        "locationPath",
        "tags",
        "barcodes",
        "specs",
        "imageIds",
        "mpn",
        "manufacturer",
        "supplier",
        "unitCost",
        "purchaseUrl",
        "datasheetUrl",
        "notes",
        "favorite",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    },
    "activity": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "targetKind": {
            "type": "string"
          },
          "targetId": {
            "type": "string"
          },
          "targetName": {
            "type": "string"
          },
          "action": {
            "type": "string",
            "enum": [
              "created",
              "updated",
              "quantity",
              "moved",
              "labeled",
              "deleted",
              "imported"
            ]
          },
          "detail": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "userId": {
            "type": [
              "string",
              "null"
            ]
          },
          "at": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "targetKind",
          "targetId",
          "targetName",
          "action",
          "detail",
          "userId",
          "at"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "item",
    "activity"
  ],
  "additionalProperties": false
}
```

### `PATCH /items/:id` — updateItem

Partial update; changes are diffed into the activity log.

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
    "category": {
      "type": "string"
    },
    "quantity": {
      "type": "number"
    },
    "unit": {
      "type": "string"
    },
    "minQuantity": {
      "type": [
        "number",
        "null"
      ]
    },
    "locationId": {
      "type": [
        "string",
        "null"
      ]
    },
    "code": {
      "description": "Label code (scanned/typed); must not be on another item or place",
      "type": [
        "string",
        "null"
      ]
    },
    "autoCode": {
      "description": "Allocate a fresh pool code when `code` is empty",
      "type": "boolean"
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "barcodes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "specs": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "imageIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "mpn": {
      "type": "string"
    },
    "manufacturer": {
      "type": "string"
    },
    "supplier": {
      "type": "string"
    },
    "unitCost": {
      "type": [
        "number",
        "null"
      ]
    },
    "purchaseUrl": {
      "type": "string"
    },
    "datasheetUrl": {
      "type": "string"
    },
    "notes": {
      "type": "string"
    },
    "favorite": {
      "type": "boolean"
    },
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
    "code": {
      "description": "Our printed label code (canonical, e.g. K7QM2X)",
      "type": [
        "string",
        "null"
      ]
    },
    "codeDisplay": {
      "description": "Display form, e.g. K7Q-M2X",
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "category": {
      "type": "string"
    },
    "quantity": {
      "type": "number"
    },
    "unit": {
      "type": "string"
    },
    "minQuantity": {
      "type": [
        "number",
        "null"
      ]
    },
    "low": {
      "type": "boolean"
    },
    "locationId": {
      "type": [
        "string",
        "null"
      ]
    },
    "locationPath": {
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
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "kind"
        ],
        "additionalProperties": false
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "barcodes": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Manufacturer EAN/UPC/QR payloads found on the product"
    },
    "specs": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "imageIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "mpn": {
      "type": "string"
    },
    "manufacturer": {
      "type": "string"
    },
    "supplier": {
      "type": "string"
    },
    "unitCost": {
      "type": [
        "number",
        "null"
      ]
    },
    "purchaseUrl": {
      "type": "string"
    },
    "datasheetUrl": {
      "type": "string"
    },
    "notes": {
      "type": "string"
    },
    "favorite": {
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
    "code",
    "codeDisplay",
    "name",
    "description",
    "category",
    "quantity",
    "unit",
    "minQuantity",
    "low",
    "locationId",
    "locationPath",
    "tags",
    "barcodes",
    "specs",
    "imageIds",
    "mpn",
    "manufacturer",
    "supplier",
    "unitCost",
    "purchaseUrl",
    "datasheetUrl",
    "notes",
    "favorite",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /items/:id` — deleteItem

Deletes an item (its label code becomes free again after the re-issue window).

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

### `POST /items/:id/adjust` — adjustQuantity

Stock in/out: `delta` (+/-) or absolute `set`. Clamped at 0.

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
    "delta": {
      "type": "number"
    },
    "set": {
      "type": "number"
    },
    "reason": {
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
    "code": {
      "description": "Our printed label code (canonical, e.g. K7QM2X)",
      "type": [
        "string",
        "null"
      ]
    },
    "codeDisplay": {
      "description": "Display form, e.g. K7Q-M2X",
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "category": {
      "type": "string"
    },
    "quantity": {
      "type": "number"
    },
    "unit": {
      "type": "string"
    },
    "minQuantity": {
      "type": [
        "number",
        "null"
      ]
    },
    "low": {
      "type": "boolean"
    },
    "locationId": {
      "type": [
        "string",
        "null"
      ]
    },
    "locationPath": {
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
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "kind"
        ],
        "additionalProperties": false
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "barcodes": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Manufacturer EAN/UPC/QR payloads found on the product"
    },
    "specs": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "imageIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "mpn": {
      "type": "string"
    },
    "manufacturer": {
      "type": "string"
    },
    "supplier": {
      "type": "string"
    },
    "unitCost": {
      "type": [
        "number",
        "null"
      ]
    },
    "purchaseUrl": {
      "type": "string"
    },
    "datasheetUrl": {
      "type": "string"
    },
    "notes": {
      "type": "string"
    },
    "favorite": {
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
    "code",
    "codeDisplay",
    "name",
    "description",
    "category",
    "quantity",
    "unit",
    "minQuantity",
    "low",
    "locationId",
    "locationPath",
    "tags",
    "barcodes",
    "specs",
    "imageIds",
    "mpn",
    "manufacturer",
    "supplier",
    "unitCost",
    "purchaseUrl",
    "datasheetUrl",
    "notes",
    "favorite",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `POST /items/move` — moveItems

Moves items into a place (null = unplaced). Used by scan put-away mode.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "itemIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "locationId": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "itemIds",
    "locationId"
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
    "moved": {
      "type": "number"
    }
  },
  "required": [
    "moved"
  ],
  "additionalProperties": false
}
```

### `GET /tags` — listTags

All tags with usage counts.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "tags": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "tag": {
            "type": "string"
          },
          "n": {
            "type": "number"
          }
        },
        "required": [
          "tag",
          "n"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "tags"
  ],
  "additionalProperties": false
}
```

### `GET /locations` — listLocations

Every place in tree (depth-first) order with direct + recursive item counts.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "locations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "code": {
            "type": [
              "string",
              "null"
            ]
          },
          "codeDisplay": {
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "kind": {
            "type": "string"
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "description": {
            "type": "string"
          },
          "color": {
            "type": [
              "string",
              "null"
            ]
          },
          "imageId": {
            "type": [
              "string",
              "null"
            ]
          },
          "path": {
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
                  "type": "string"
                }
              },
              "required": [
                "id",
                "name",
                "kind"
              ],
              "additionalProperties": false
            }
          },
          "depth": {
            "type": "number"
          },
          "itemCount": {
            "type": "number"
          },
          "totalItemCount": {
            "type": "number"
          },
          "childCount": {
            "type": "number"
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
          "code",
          "codeDisplay",
          "name",
          "kind",
          "parentId",
          "description",
          "color",
          "imageId",
          "path",
          "depth",
          "itemCount",
          "totalItemCount",
          "childCount",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "unplacedCount": {
      "type": "number"
    }
  },
  "required": [
    "locations",
    "unplacedCount"
  ],
  "additionalProperties": false
}
```

### `POST /locations` — createLocation

Creates a place (room/shelf/box…).

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
    "kind": {
      "description": "room | cabinet | shelf | rack | drawer | bin | box | organizer | bag | other",
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "description": {
      "type": "string"
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "imageId": {
      "type": [
        "string",
        "null"
      ]
    },
    "code": {
      "type": [
        "string",
        "null"
      ]
    },
    "autoCode": {
      "type": "boolean"
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
    "code": {
      "type": [
        "string",
        "null"
      ]
    },
    "codeDisplay": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "kind": {
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "description": {
      "type": "string"
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "imageId": {
      "type": [
        "string",
        "null"
      ]
    },
    "path": {
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
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "kind"
        ],
        "additionalProperties": false
      }
    },
    "depth": {
      "type": "number"
    },
    "itemCount": {
      "type": "number"
    },
    "totalItemCount": {
      "type": "number"
    },
    "childCount": {
      "type": "number"
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
    "code",
    "codeDisplay",
    "name",
    "kind",
    "parentId",
    "description",
    "color",
    "imageId",
    "path",
    "depth",
    "itemCount",
    "totalItemCount",
    "childCount",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `GET /locations/:id` — getLocation

A place with its direct children, direct items and activity.

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
    "location": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "code": {
          "type": [
            "string",
            "null"
          ]
        },
        "codeDisplay": {
          "type": [
            "string",
            "null"
          ]
        },
        "name": {
          "type": "string"
        },
        "kind": {
          "type": "string"
        },
        "parentId": {
          "type": [
            "string",
            "null"
          ]
        },
        "description": {
          "type": "string"
        },
        "color": {
          "type": [
            "string",
            "null"
          ]
        },
        "imageId": {
          "type": [
            "string",
            "null"
          ]
        },
        "path": {
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
                "type": "string"
              }
            },
            "required": [
              "id",
              "name",
              "kind"
            ],
            "additionalProperties": false
          }
        },
        "depth": {
          "type": "number"
        },
        "itemCount": {
          "type": "number"
        },
        "totalItemCount": {
          "type": "number"
        },
        "childCount": {
          "type": "number"
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
        "code",
        "codeDisplay",
        "name",
        "kind",
        "parentId",
        "description",
        "color",
        "imageId",
        "path",
        "depth",
        "itemCount",
        "totalItemCount",
        "childCount",
        "createdAt",
        "updatedAt"
      ],
      "additionalProperties": false
    },
    "children": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "code": {
            "type": [
              "string",
              "null"
            ]
          },
          "codeDisplay": {
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "kind": {
            "type": "string"
          },
          "parentId": {
            "type": [
              "string",
              "null"
            ]
          },
          "description": {
            "type": "string"
          },
          "color": {
            "type": [
              "string",
              "null"
            ]
          },
          "imageId": {
            "type": [
              "string",
              "null"
            ]
          },
          "path": {
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
                  "type": "string"
                }
              },
              "required": [
                "id",
                "name",
                "kind"
              ],
              "additionalProperties": false
            }
          },
          "depth": {
            "type": "number"
          },
          "itemCount": {
            "type": "number"
          },
          "totalItemCount": {
            "type": "number"
          },
          "childCount": {
            "type": "number"
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
          "code",
          "codeDisplay",
          "name",
          "kind",
          "parentId",
          "description",
          "color",
          "imageId",
          "path",
          "depth",
          "itemCount",
          "totalItemCount",
          "childCount",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
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
          "code": {
            "description": "Our printed label code (canonical, e.g. K7QM2X)",
            "type": [
              "string",
              "null"
            ]
          },
          "codeDisplay": {
            "description": "Display form, e.g. K7Q-M2X",
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "category": {
            "type": "string"
          },
          "quantity": {
            "type": "number"
          },
          "unit": {
            "type": "string"
          },
          "minQuantity": {
            "type": [
              "number",
              "null"
            ]
          },
          "low": {
            "type": "boolean"
          },
          "locationId": {
            "type": [
              "string",
              "null"
            ]
          },
          "locationPath": {
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
                  "type": "string"
                }
              },
              "required": [
                "id",
                "name",
                "kind"
              ],
              "additionalProperties": false
            }
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "barcodes": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Manufacturer EAN/UPC/QR payloads found on the product"
          },
          "specs": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "string"
            }
          },
          "imageIds": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "mpn": {
            "type": "string"
          },
          "manufacturer": {
            "type": "string"
          },
          "supplier": {
            "type": "string"
          },
          "unitCost": {
            "type": [
              "number",
              "null"
            ]
          },
          "purchaseUrl": {
            "type": "string"
          },
          "datasheetUrl": {
            "type": "string"
          },
          "notes": {
            "type": "string"
          },
          "favorite": {
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
          "code",
          "codeDisplay",
          "name",
          "description",
          "category",
          "quantity",
          "unit",
          "minQuantity",
          "low",
          "locationId",
          "locationPath",
          "tags",
          "barcodes",
          "specs",
          "imageIds",
          "mpn",
          "manufacturer",
          "supplier",
          "unitCost",
          "purchaseUrl",
          "datasheetUrl",
          "notes",
          "favorite",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "activity": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "targetKind": {
            "type": "string"
          },
          "targetId": {
            "type": "string"
          },
          "targetName": {
            "type": "string"
          },
          "action": {
            "type": "string",
            "enum": [
              "created",
              "updated",
              "quantity",
              "moved",
              "labeled",
              "deleted",
              "imported"
            ]
          },
          "detail": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "userId": {
            "type": [
              "string",
              "null"
            ]
          },
          "at": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "targetKind",
          "targetId",
          "targetName",
          "action",
          "detail",
          "userId",
          "at"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "location",
    "children",
    "items",
    "activity"
  ],
  "additionalProperties": false
}
```

### `PATCH /locations/:id` — updateLocation

Partial update. Re-parenting into own subtree → 400 cycle.

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
    "kind": {
      "description": "room | cabinet | shelf | rack | drawer | bin | box | organizer | bag | other",
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "description": {
      "type": "string"
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "imageId": {
      "type": [
        "string",
        "null"
      ]
    },
    "code": {
      "type": [
        "string",
        "null"
      ]
    },
    "autoCode": {
      "type": "boolean"
    },
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
    "code": {
      "type": [
        "string",
        "null"
      ]
    },
    "codeDisplay": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "kind": {
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "description": {
      "type": "string"
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "imageId": {
      "type": [
        "string",
        "null"
      ]
    },
    "path": {
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
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "kind"
        ],
        "additionalProperties": false
      }
    },
    "depth": {
      "type": "number"
    },
    "itemCount": {
      "type": "number"
    },
    "totalItemCount": {
      "type": "number"
    },
    "childCount": {
      "type": "number"
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
    "code",
    "codeDisplay",
    "name",
    "kind",
    "parentId",
    "description",
    "color",
    "imageId",
    "path",
    "depth",
    "itemCount",
    "totalItemCount",
    "childCount",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /locations/:id` — deleteLocation

Deletes a place. Non-empty → 409 location_not_empty unless contents=parent (children + items move one level up).

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
    "contents": {
      "type": "string",
      "enum": [
        "parent"
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

### `POST /codes/generate` — generateCodes

Bulk-generates random (non-sequential) 6-char label codes for printing. A code is never handed out if it was generated in the last 7 days or is on any item/place.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "count": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1000
    },
    "note": {
      "type": "string"
    }
  },
  "required": [
    "count"
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
    "batchId": {
      "type": [
        "string",
        "null"
      ]
    },
    "codes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string"
          },
          "display": {
            "type": "string"
          }
        },
        "required": [
          "code",
          "display"
        ],
        "additionalProperties": false
      }
    },
    "reissueWindowDays": {
      "type": "number"
    }
  },
  "required": [
    "batchId",
    "codes",
    "reissueWindowDays"
  ],
  "additionalProperties": false
}
```

### `POST /codes/next` — nextCode

Allocates a single fresh code (same uniqueness rules), not tied to a print batch.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "code": {
      "type": "string"
    },
    "display": {
      "type": "string"
    }
  },
  "required": [
    "code",
    "display"
  ],
  "additionalProperties": false
}
```

### `GET /codes/batches` — listCodeBatches

Print batches with how many of their codes are in use, plus pool totals.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "batches": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "count": {
            "type": "number"
          },
          "note": {
            "type": "string"
          },
          "createdAt": {
            "type": "string"
          },
          "live": {
            "type": "number"
          },
          "used": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "count",
          "note",
          "createdAt",
          "live",
          "used"
        ],
        "additionalProperties": false
      }
    },
    "pool": {
      "type": "object",
      "properties": {
        "free": {
          "type": "number"
        },
        "fresh": {
          "type": "number"
        }
      },
      "required": [
        "free",
        "fresh"
      ],
      "additionalProperties": false
    },
    "reissueWindowDays": {
      "type": "number"
    }
  },
  "required": [
    "batches",
    "pool",
    "reissueWindowDays"
  ],
  "additionalProperties": false
}
```

### `GET /codes/batches/:id` — getCodeBatch

Codes in a batch (for re-printing) and what each is used by.

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
    "batch": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "count": {
          "type": "number"
        },
        "note": {
          "type": "string"
        },
        "createdAt": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "count",
        "note",
        "createdAt"
      ],
      "additionalProperties": false
    },
    "codes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string"
          },
          "display": {
            "type": "string"
          },
          "usedBy": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "kind": {
                    "type": "string"
                  },
                  "id": {
                    "type": "string"
                  },
                  "name": {
                    "type": [
                      "string",
                      "null"
                    ]
                  }
                },
                "required": [
                  "kind",
                  "id",
                  "name"
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
          "code",
          "display",
          "usedBy"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "batch",
    "codes"
  ],
  "additionalProperties": false
}
```

### `GET /resolve` — resolveCode

Resolves anything scanned: our label (bare, dashed, TT: prefixed or a /c/CODE deep link) → item/location, a free label → free_code, a manufacturer barcode/QR → items carrying it.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "code": {
      "type": "string"
    }
  },
  "required": [
    "code"
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
    "raw": {
      "type": "string"
    },
    "code": {
      "type": [
        "string",
        "null"
      ]
    },
    "matches": {
      "type": "array",
      "items": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "item"
              },
              "via": {
                "type": "string",
                "enum": [
                  "label",
                  "barcode"
                ]
              },
              "item": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "code": {
                    "description": "Our printed label code (canonical, e.g. K7QM2X)",
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "codeDisplay": {
                    "description": "Display form, e.g. K7Q-M2X",
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "name": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  },
                  "category": {
                    "type": "string"
                  },
                  "quantity": {
                    "type": "number"
                  },
                  "unit": {
                    "type": "string"
                  },
                  "minQuantity": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "low": {
                    "type": "boolean"
                  },
                  "locationId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "locationPath": {
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
                          "type": "string"
                        }
                      },
                      "required": [
                        "id",
                        "name",
                        "kind"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "tags": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "barcodes": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Manufacturer EAN/UPC/QR payloads found on the product"
                  },
                  "specs": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {
                      "type": "string"
                    }
                  },
                  "imageIds": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "mpn": {
                    "type": "string"
                  },
                  "manufacturer": {
                    "type": "string"
                  },
                  "supplier": {
                    "type": "string"
                  },
                  "unitCost": {
                    "type": [
                      "number",
                      "null"
                    ]
                  },
                  "purchaseUrl": {
                    "type": "string"
                  },
                  "datasheetUrl": {
                    "type": "string"
                  },
                  "notes": {
                    "type": "string"
                  },
                  "favorite": {
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
                  "code",
                  "codeDisplay",
                  "name",
                  "description",
                  "category",
                  "quantity",
                  "unit",
                  "minQuantity",
                  "low",
                  "locationId",
                  "locationPath",
                  "tags",
                  "barcodes",
                  "specs",
                  "imageIds",
                  "mpn",
                  "manufacturer",
                  "supplier",
                  "unitCost",
                  "purchaseUrl",
                  "datasheetUrl",
                  "notes",
                  "favorite",
                  "createdAt",
                  "updatedAt"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "type",
              "via",
              "item"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "location"
              },
              "location": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "code": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "codeDisplay": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "name": {
                    "type": "string"
                  },
                  "kind": {
                    "type": "string"
                  },
                  "parentId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "description": {
                    "type": "string"
                  },
                  "color": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "imageId": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "path": {
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
                          "type": "string"
                        }
                      },
                      "required": [
                        "id",
                        "name",
                        "kind"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "depth": {
                    "type": "number"
                  },
                  "itemCount": {
                    "type": "number"
                  },
                  "totalItemCount": {
                    "type": "number"
                  },
                  "childCount": {
                    "type": "number"
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
                  "code",
                  "codeDisplay",
                  "name",
                  "kind",
                  "parentId",
                  "description",
                  "color",
                  "imageId",
                  "path",
                  "depth",
                  "itemCount",
                  "totalItemCount",
                  "childCount",
                  "createdAt",
                  "updatedAt"
                ],
                "additionalProperties": false
              }
            },
            "required": [
              "type",
              "location"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "free_code"
              },
              "code": {
                "type": "string"
              },
              "display": {
                "type": "string"
              },
              "inPool": {
                "type": "boolean"
              },
              "generatedAt": {
                "type": [
                  "string",
                  "null"
                ]
              }
            },
            "required": [
              "type",
              "code",
              "display",
              "inPool",
              "generatedAt"
            ],
            "additionalProperties": false
          }
        ]
      }
    }
  },
  "required": [
    "raw",
    "code",
    "matches"
  ],
  "additionalProperties": false
}
```

### `GET /stats` — stats

Dashboard: totals, per-category counts/value, low stock, recently added, favorites, recent activity.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "totals": {
      "type": "object",
      "properties": {
        "items": {
          "type": "number"
        },
        "units": {
          "type": "number"
        },
        "value": {
          "type": "number"
        },
        "low": {
          "type": "number"
        },
        "unplaced": {
          "type": "number"
        },
        "unlabeled": {
          "type": "number"
        },
        "locations": {
          "type": "number"
        }
      },
      "required": [
        "items",
        "units",
        "value",
        "low",
        "unplaced",
        "unlabeled",
        "locations"
      ],
      "additionalProperties": false
    },
    "categories": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "category": {
            "type": "string"
          },
          "n": {
            "type": "number"
          },
          "value": {
            "type": "number"
          }
        },
        "required": [
          "category",
          "n",
          "value"
        ],
        "additionalProperties": false
      }
    },
    "lowStock": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "code": {
            "description": "Our printed label code (canonical, e.g. K7QM2X)",
            "type": [
              "string",
              "null"
            ]
          },
          "codeDisplay": {
            "description": "Display form, e.g. K7Q-M2X",
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "category": {
            "type": "string"
          },
          "quantity": {
            "type": "number"
          },
          "unit": {
            "type": "string"
          },
          "minQuantity": {
            "type": [
              "number",
              "null"
            ]
          },
          "low": {
            "type": "boolean"
          },
          "locationId": {
            "type": [
              "string",
              "null"
            ]
          },
          "locationPath": {
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
                  "type": "string"
                }
              },
              "required": [
                "id",
                "name",
                "kind"
              ],
              "additionalProperties": false
            }
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "barcodes": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Manufacturer EAN/UPC/QR payloads found on the product"
          },
          "specs": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "string"
            }
          },
          "imageIds": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "mpn": {
            "type": "string"
          },
          "manufacturer": {
            "type": "string"
          },
          "supplier": {
            "type": "string"
          },
          "unitCost": {
            "type": [
              "number",
              "null"
            ]
          },
          "purchaseUrl": {
            "type": "string"
          },
          "datasheetUrl": {
            "type": "string"
          },
          "notes": {
            "type": "string"
          },
          "favorite": {
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
          "code",
          "codeDisplay",
          "name",
          "description",
          "category",
          "quantity",
          "unit",
          "minQuantity",
          "low",
          "locationId",
          "locationPath",
          "tags",
          "barcodes",
          "specs",
          "imageIds",
          "mpn",
          "manufacturer",
          "supplier",
          "unitCost",
          "purchaseUrl",
          "datasheetUrl",
          "notes",
          "favorite",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "recent": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "code": {
            "description": "Our printed label code (canonical, e.g. K7QM2X)",
            "type": [
              "string",
              "null"
            ]
          },
          "codeDisplay": {
            "description": "Display form, e.g. K7Q-M2X",
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "category": {
            "type": "string"
          },
          "quantity": {
            "type": "number"
          },
          "unit": {
            "type": "string"
          },
          "minQuantity": {
            "type": [
              "number",
              "null"
            ]
          },
          "low": {
            "type": "boolean"
          },
          "locationId": {
            "type": [
              "string",
              "null"
            ]
          },
          "locationPath": {
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
                  "type": "string"
                }
              },
              "required": [
                "id",
                "name",
                "kind"
              ],
              "additionalProperties": false
            }
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "barcodes": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Manufacturer EAN/UPC/QR payloads found on the product"
          },
          "specs": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "string"
            }
          },
          "imageIds": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "mpn": {
            "type": "string"
          },
          "manufacturer": {
            "type": "string"
          },
          "supplier": {
            "type": "string"
          },
          "unitCost": {
            "type": [
              "number",
              "null"
            ]
          },
          "purchaseUrl": {
            "type": "string"
          },
          "datasheetUrl": {
            "type": "string"
          },
          "notes": {
            "type": "string"
          },
          "favorite": {
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
          "code",
          "codeDisplay",
          "name",
          "description",
          "category",
          "quantity",
          "unit",
          "minQuantity",
          "low",
          "locationId",
          "locationPath",
          "tags",
          "barcodes",
          "specs",
          "imageIds",
          "mpn",
          "manufacturer",
          "supplier",
          "unitCost",
          "purchaseUrl",
          "datasheetUrl",
          "notes",
          "favorite",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "favorites": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "code": {
            "description": "Our printed label code (canonical, e.g. K7QM2X)",
            "type": [
              "string",
              "null"
            ]
          },
          "codeDisplay": {
            "description": "Display form, e.g. K7Q-M2X",
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "category": {
            "type": "string"
          },
          "quantity": {
            "type": "number"
          },
          "unit": {
            "type": "string"
          },
          "minQuantity": {
            "type": [
              "number",
              "null"
            ]
          },
          "low": {
            "type": "boolean"
          },
          "locationId": {
            "type": [
              "string",
              "null"
            ]
          },
          "locationPath": {
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
                  "type": "string"
                }
              },
              "required": [
                "id",
                "name",
                "kind"
              ],
              "additionalProperties": false
            }
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "barcodes": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Manufacturer EAN/UPC/QR payloads found on the product"
          },
          "specs": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "string"
            }
          },
          "imageIds": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "mpn": {
            "type": "string"
          },
          "manufacturer": {
            "type": "string"
          },
          "supplier": {
            "type": "string"
          },
          "unitCost": {
            "type": [
              "number",
              "null"
            ]
          },
          "purchaseUrl": {
            "type": "string"
          },
          "datasheetUrl": {
            "type": "string"
          },
          "notes": {
            "type": "string"
          },
          "favorite": {
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
          "code",
          "codeDisplay",
          "name",
          "description",
          "category",
          "quantity",
          "unit",
          "minQuantity",
          "low",
          "locationId",
          "locationPath",
          "tags",
          "barcodes",
          "specs",
          "imageIds",
          "mpn",
          "manufacturer",
          "supplier",
          "unitCost",
          "purchaseUrl",
          "datasheetUrl",
          "notes",
          "favorite",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "activity": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "targetKind": {
            "type": "string"
          },
          "targetId": {
            "type": "string"
          },
          "targetName": {
            "type": "string"
          },
          "action": {
            "type": "string",
            "enum": [
              "created",
              "updated",
              "quantity",
              "moved",
              "labeled",
              "deleted",
              "imported"
            ]
          },
          "detail": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "userId": {
            "type": [
              "string",
              "null"
            ]
          },
          "at": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "targetKind",
          "targetId",
          "targetName",
          "action",
          "detail",
          "userId",
          "at"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "totals",
    "categories",
    "lowStock",
    "recent",
    "favorites",
    "activity"
  ],
  "additionalProperties": false
}
```

### `GET /activity` — listActivity

Activity log, newest first; `before` = id cursor.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "target": {
      "type": "string"
    },
    "limit": {
      "type": "string"
    },
    "before": {
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
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "targetKind": {
            "type": "string"
          },
          "targetId": {
            "type": "string"
          },
          "targetName": {
            "type": "string"
          },
          "action": {
            "type": "string",
            "enum": [
              "created",
              "updated",
              "quantity",
              "moved",
              "labeled",
              "deleted",
              "imported"
            ]
          },
          "detail": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          },
          "userId": {
            "type": [
              "string",
              "null"
            ]
          },
          "at": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "targetKind",
          "targetId",
          "targetName",
          "action",
          "detail",
          "userId",
          "at"
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

### `POST /images` — uploadImage

Raw image body (content-type image/*, ≤ 8 MB). Returns the id to put in imageIds/imageId.

- **Auth**: `session-or-apiKey`

**Response**
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

### `GET /images/:id` — getImage

Image bytes (immutable cache).

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

### `GET /export.csv` — exportCsv

All items as CSV (location as 'A > B > C' path, specs as k=v; pairs).

- **Auth**: `session-or-apiKey`

### `POST /import` — importCsv

Imports items from CSV (headers auto-mapped; missing location paths are created). dryRun validates only.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "csv": {
      "type": "string"
    },
    "dryRun": {
      "type": "boolean"
    }
  },
  "required": [
    "csv"
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
      "type": "number"
    },
    "errors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "row": {
            "type": "number"
          },
          "error": {
            "type": "string"
          }
        },
        "required": [
          "row",
          "error"
        ],
        "additionalProperties": false
      }
    },
    "dryRun": {
      "type": "boolean"
    },
    "columns": {
      "type": "array",
      "items": {
        "type": [
          "string",
          "null"
        ]
      }
    }
  },
  "required": [
    "created",
    "errors",
    "dryRun",
    "columns"
  ],
  "additionalProperties": false
}
```
