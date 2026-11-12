# ENDPOINTS.md — TwoDoo

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Tasks & habits — TickTick-style boards, lists, smart lists, quick-add, recurrence, habit tracking. Implemented (v1).

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twodoo`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T17:41:01.442Z_

## Endpoints

### `GET /boards` — listBoards

Full board forest for the caller's active spaces: root boards with nested children, each with lists and rollup open/due-today counts.

- **Auth**: `session`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "$ref": "#/definitions/__schema0"
  },
  "definitions": {
    "__schema0": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "parentId": {
          "type": [
            "string",
            "null"
          ]
        },
        "name": {
          "type": "string"
        },
        "color": {
          "type": [
            "string",
            "null"
          ]
        },
        "icon": {
          "type": [
            "string",
            "null"
          ]
        },
        "position": {
          "type": "number"
        },
        "collapsed": {
          "type": "boolean"
        },
        "spaceId": {
          "type": "string"
        },
        "createdAt": {
          "type": "string"
        },
        "updatedAt": {
          "type": "string"
        },
        "lists": {
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
              "name": {
                "type": "string"
              },
              "color": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "icon": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "position": {
                "type": "number"
              },
              "openCount": {
                "type": "number"
              },
              "dueTodayCount": {
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
              "boardId",
              "name",
              "color",
              "icon",
              "position",
              "openCount",
              "dueTodayCount",
              "createdAt",
              "updatedAt"
            ],
            "additionalProperties": false
          }
        },
        "children": {
          "type": "array",
          "items": {
            "allOf": [
              {
                "$ref": "#/definitions/__schema0"
              }
            ]
          }
        },
        "openCount": {
          "type": "number"
        },
        "dueTodayCount": {
          "type": "number"
        }
      },
      "required": [
        "id",
        "parentId",
        "name",
        "position",
        "collapsed",
        "spaceId",
        "createdAt",
        "updatedAt",
        "lists",
        "children",
        "openCount",
        "dueTodayCount"
      ],
      "additionalProperties": false
    }
  }
}
```

### `POST /boards` — createBoard

Creates a board in a space, optionally nested under a parent board (same space).

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "spaceId": {
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "spaceId",
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
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "collapsed": {
      "type": "boolean"
    },
    "spaceId": {
      "type": "string"
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    },
    "lists": {
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
          "name": {
            "type": "string"
          },
          "color": {
            "type": [
              "string",
              "null"
            ]
          },
          "icon": {
            "type": [
              "string",
              "null"
            ]
          },
          "position": {
            "type": "number"
          },
          "openCount": {
            "type": "number"
          },
          "dueTodayCount": {
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
          "boardId",
          "name",
          "color",
          "icon",
          "position",
          "openCount",
          "dueTodayCount",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "children": {
      "type": "array",
      "items": {
        "allOf": [
          {
            "$ref": "#"
          }
        ]
      }
    },
    "openCount": {
      "type": "number"
    },
    "dueTodayCount": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "parentId",
    "name",
    "position",
    "collapsed",
    "spaceId",
    "createdAt",
    "updatedAt",
    "lists",
    "children",
    "openCount",
    "dueTodayCount"
  ],
  "additionalProperties": false
}
```

### `PATCH /boards/:id` — updateBoard

Rename / recolor / re-parent (cycle-guarded) / reorder / collapse a board.

- **Auth**: `session`

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
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "collapsed": {
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
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "collapsed": {
      "type": "boolean"
    },
    "spaceId": {
      "type": "string"
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    },
    "lists": {
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
          "name": {
            "type": "string"
          },
          "color": {
            "type": [
              "string",
              "null"
            ]
          },
          "icon": {
            "type": [
              "string",
              "null"
            ]
          },
          "position": {
            "type": "number"
          },
          "openCount": {
            "type": "number"
          },
          "dueTodayCount": {
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
          "boardId",
          "name",
          "color",
          "icon",
          "position",
          "openCount",
          "dueTodayCount",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "children": {
      "type": "array",
      "items": {
        "allOf": [
          {
            "$ref": "#"
          }
        ]
      }
    },
    "openCount": {
      "type": "number"
    },
    "dueTodayCount": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "parentId",
    "name",
    "position",
    "collapsed",
    "spaceId",
    "createdAt",
    "updatedAt",
    "lists",
    "children",
    "openCount",
    "dueTodayCount"
  ],
  "additionalProperties": false
}
```

### `DELETE /boards/:id` — deleteBoard

Deletes a board with every descendant board, list, task, checklist and tag link.

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
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `POST /lists` — createList

Creates a task list inside a board.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "boardId": {
      "type": "string"
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "boardId",
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
    "boardId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "openCount": {
      "type": "number"
    },
    "dueTodayCount": {
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
    "boardId",
    "name",
    "color",
    "icon",
    "position",
    "openCount",
    "dueTodayCount",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /lists/:id` — updateList

Rename / recolor / move-to-board / reorder a list.

- **Auth**: `session`

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
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "boardId": {
      "type": "string"
    },
    "position": {
      "type": "number"
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
    "name": {
      "type": "string"
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "openCount": {
      "type": "number"
    },
    "dueTodayCount": {
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
    "boardId",
    "name",
    "color",
    "icon",
    "position",
    "openCount",
    "dueTodayCount",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /lists/:id` — deleteList

Deletes a list and all its tasks (hard delete).

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
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `GET /tasks` — listTasks

Task query endpoint. One of listId / boardId / smart selects the set; filters compose. `smart` ∈ today|tomorrow|week|month|all|completed (today/week/month include overdue open tasks).

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "listId": {
      "type": "string"
    },
    "boardId": {
      "type": "string"
    },
    "smart": {
      "type": "string",
      "enum": [
        "today",
        "tomorrow",
        "week",
        "month",
        "all",
        "completed"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "open",
        "done",
        "trashed",
        "any"
      ]
    },
    "tagId": {
      "type": "string"
    },
    "q": {
      "type": "string"
    },
    "from": {
      "type": "string"
    },
    "to": {
      "type": "string"
    },
    "limit": {
      "type": "number"
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
      "listId": {
        "type": "string"
      },
      "parentId": {
        "type": [
          "string",
          "null"
        ]
      },
      "title": {
        "type": "string"
      },
      "descriptionHtml": {
        "type": [
          "string",
          "null"
        ]
      },
      "status": {
        "type": "string",
        "enum": [
          "open",
          "done",
          "trashed"
        ]
      },
      "priority": {
        "type": "string",
        "enum": [
          "none",
          "low",
          "medium",
          "high",
          "urgent"
        ]
      },
      "startAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "endAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "allDay": {
        "type": "boolean"
      },
      "recurrenceRule": {
        "type": [
          "string",
          "null"
        ]
      },
      "recurrenceNextAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "habitId": {
        "type": [
          "string",
          "null"
        ]
      },
      "completedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "assigneeUserId": {
        "type": [
          "string",
          "null"
        ]
      },
      "position": {
        "type": "number"
      },
      "createdAt": {
        "type": "string"
      },
      "updatedAt": {
        "type": "string"
      },
      "tags": {
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
            "color": {
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
            "color",
            "createdAt"
          ],
          "additionalProperties": false
        }
      },
      "checklist": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "taskId": {
              "type": "string"
            },
            "content": {
              "type": "string"
            },
            "checked": {
              "type": "boolean"
            },
            "position": {
              "type": "number"
            }
          },
          "required": [
            "id",
            "taskId",
            "content",
            "checked",
            "position"
          ],
          "additionalProperties": false
        }
      },
      "checklistTotal": {
        "type": "number"
      },
      "checklistDone": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "listId",
      "parentId",
      "title",
      "descriptionHtml",
      "status",
      "priority",
      "startAt",
      "endAt",
      "allDay",
      "recurrenceRule",
      "recurrenceNextAt",
      "habitId",
      "completedAt",
      "assigneeUserId",
      "position",
      "createdAt",
      "updatedAt",
      "tags",
      "checklist",
      "checklistTotal",
      "checklistDone"
    ],
    "additionalProperties": false
  }
}
```

### `POST /tasks` — createTask

Creates a task. `tagNames` auto-creates missing tags in the task's space (quick-add path); `tagIds` links existing ones. Recurring tasks compute recurrence_next_at from startAt.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "listId": {
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": "string",
      "minLength": 1
    },
    "descriptionHtml": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "type": "string",
      "enum": [
        "none",
        "low",
        "medium",
        "high",
        "urgent"
      ]
    },
    "startAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "endAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "allDay": {
      "type": "boolean"
    },
    "recurrenceRule": {
      "type": [
        "string",
        "null"
      ]
    },
    "habitId": {
      "type": [
        "string",
        "null"
      ]
    },
    "assigneeUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "tagIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "tagNames": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "listId",
    "title"
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
    "listId": {
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": "string"
    },
    "descriptionHtml": {
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "open",
        "done",
        "trashed"
      ]
    },
    "priority": {
      "type": "string",
      "enum": [
        "none",
        "low",
        "medium",
        "high",
        "urgent"
      ]
    },
    "startAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "endAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "allDay": {
      "type": "boolean"
    },
    "recurrenceRule": {
      "type": [
        "string",
        "null"
      ]
    },
    "recurrenceNextAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "habitId": {
      "type": [
        "string",
        "null"
      ]
    },
    "completedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "assigneeUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    },
    "tags": {
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
          "color": {
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
          "color",
          "createdAt"
        ],
        "additionalProperties": false
      }
    },
    "checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "taskId": {
            "type": "string"
          },
          "content": {
            "type": "string"
          },
          "checked": {
            "type": "boolean"
          },
          "position": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "taskId",
          "content",
          "checked",
          "position"
        ],
        "additionalProperties": false
      }
    },
    "checklistTotal": {
      "type": "number"
    },
    "checklistDone": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "listId",
    "parentId",
    "title",
    "descriptionHtml",
    "status",
    "priority",
    "startAt",
    "endAt",
    "allDay",
    "recurrenceRule",
    "recurrenceNextAt",
    "habitId",
    "completedAt",
    "assigneeUserId",
    "position",
    "createdAt",
    "updatedAt",
    "tags",
    "checklist",
    "checklistTotal",
    "checklistDone"
  ],
  "additionalProperties": false
}
```

### `GET /tasks/:id` — getTask

One task with tags + checklist.

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
    "id": {
      "type": "string"
    },
    "listId": {
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": "string"
    },
    "descriptionHtml": {
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "open",
        "done",
        "trashed"
      ]
    },
    "priority": {
      "type": "string",
      "enum": [
        "none",
        "low",
        "medium",
        "high",
        "urgent"
      ]
    },
    "startAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "endAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "allDay": {
      "type": "boolean"
    },
    "recurrenceRule": {
      "type": [
        "string",
        "null"
      ]
    },
    "recurrenceNextAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "habitId": {
      "type": [
        "string",
        "null"
      ]
    },
    "completedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "assigneeUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    },
    "tags": {
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
          "color": {
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
          "color",
          "createdAt"
        ],
        "additionalProperties": false
      }
    },
    "checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "taskId": {
            "type": "string"
          },
          "content": {
            "type": "string"
          },
          "checked": {
            "type": "boolean"
          },
          "position": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "taskId",
          "content",
          "checked",
          "position"
        ],
        "additionalProperties": false
      }
    },
    "checklistTotal": {
      "type": "number"
    },
    "checklistDone": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "listId",
    "parentId",
    "title",
    "descriptionHtml",
    "status",
    "priority",
    "startAt",
    "endAt",
    "allDay",
    "recurrenceRule",
    "recurrenceNextAt",
    "habitId",
    "completedAt",
    "assigneeUserId",
    "position",
    "createdAt",
    "updatedAt",
    "tags",
    "checklist",
    "checklistTotal",
    "checklistDone"
  ],
  "additionalProperties": false
}
```

### `PATCH /tasks/:id` — updateTask

Patch any task field; tagIds replaces the tag set.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "listId": {
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": "string"
    },
    "descriptionHtml": {
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "open",
        "done",
        "trashed"
      ]
    },
    "priority": {
      "type": "string",
      "enum": [
        "none",
        "low",
        "medium",
        "high",
        "urgent"
      ]
    },
    "startAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "endAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "allDay": {
      "type": "boolean"
    },
    "recurrenceRule": {
      "type": [
        "string",
        "null"
      ]
    },
    "habitId": {
      "type": [
        "string",
        "null"
      ]
    },
    "assigneeUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "tagIds": {
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
    "listId": {
      "type": "string"
    },
    "parentId": {
      "type": [
        "string",
        "null"
      ]
    },
    "title": {
      "type": "string"
    },
    "descriptionHtml": {
      "type": [
        "string",
        "null"
      ]
    },
    "status": {
      "type": "string",
      "enum": [
        "open",
        "done",
        "trashed"
      ]
    },
    "priority": {
      "type": "string",
      "enum": [
        "none",
        "low",
        "medium",
        "high",
        "urgent"
      ]
    },
    "startAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "endAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "allDay": {
      "type": "boolean"
    },
    "recurrenceRule": {
      "type": [
        "string",
        "null"
      ]
    },
    "recurrenceNextAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "habitId": {
      "type": [
        "string",
        "null"
      ]
    },
    "completedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "assigneeUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    },
    "tags": {
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
          "color": {
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
          "color",
          "createdAt"
        ],
        "additionalProperties": false
      }
    },
    "checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "taskId": {
            "type": "string"
          },
          "content": {
            "type": "string"
          },
          "checked": {
            "type": "boolean"
          },
          "position": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "taskId",
          "content",
          "checked",
          "position"
        ],
        "additionalProperties": false
      }
    },
    "checklistTotal": {
      "type": "number"
    },
    "checklistDone": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "listId",
    "parentId",
    "title",
    "descriptionHtml",
    "status",
    "priority",
    "startAt",
    "endAt",
    "allDay",
    "recurrenceRule",
    "recurrenceNextAt",
    "habitId",
    "completedAt",
    "assigneeUserId",
    "position",
    "createdAt",
    "updatedAt",
    "tags",
    "checklist",
    "checklistTotal",
    "checklistDone"
  ],
  "additionalProperties": false
}
```

### `DELETE /tasks/:id` — deleteTask

Hard-deletes a task with subtasks, checklist items and tag links. (Soft path = PATCH status=trashed.)

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
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `POST /tasks/:id/complete` — completeTask

Toggle completion, TickTick-style: completing a recurring task spawns the next occurrence (shifted dates, fresh unchecked checklist, copied tags) and returns it as `spawned`.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "done": {
      "type": "boolean"
    }
  },
  "required": [
    "id",
    "done"
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
    "task": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "listId": {
          "type": "string"
        },
        "parentId": {
          "type": [
            "string",
            "null"
          ]
        },
        "title": {
          "type": "string"
        },
        "descriptionHtml": {
          "type": [
            "string",
            "null"
          ]
        },
        "status": {
          "type": "string",
          "enum": [
            "open",
            "done",
            "trashed"
          ]
        },
        "priority": {
          "type": "string",
          "enum": [
            "none",
            "low",
            "medium",
            "high",
            "urgent"
          ]
        },
        "startAt": {
          "type": [
            "string",
            "null"
          ]
        },
        "endAt": {
          "type": [
            "string",
            "null"
          ]
        },
        "allDay": {
          "type": "boolean"
        },
        "recurrenceRule": {
          "type": [
            "string",
            "null"
          ]
        },
        "recurrenceNextAt": {
          "type": [
            "string",
            "null"
          ]
        },
        "habitId": {
          "type": [
            "string",
            "null"
          ]
        },
        "completedAt": {
          "type": [
            "string",
            "null"
          ]
        },
        "assigneeUserId": {
          "type": [
            "string",
            "null"
          ]
        },
        "position": {
          "type": "number"
        },
        "createdAt": {
          "type": "string"
        },
        "updatedAt": {
          "type": "string"
        },
        "tags": {
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
              "color": {
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
              "color",
              "createdAt"
            ],
            "additionalProperties": false
          }
        },
        "checklist": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "taskId": {
                "type": "string"
              },
              "content": {
                "type": "string"
              },
              "checked": {
                "type": "boolean"
              },
              "position": {
                "type": "number"
              }
            },
            "required": [
              "id",
              "taskId",
              "content",
              "checked",
              "position"
            ],
            "additionalProperties": false
          }
        },
        "checklistTotal": {
          "type": "number"
        },
        "checklistDone": {
          "type": "number"
        }
      },
      "required": [
        "id",
        "listId",
        "parentId",
        "title",
        "descriptionHtml",
        "status",
        "priority",
        "startAt",
        "endAt",
        "allDay",
        "recurrenceRule",
        "recurrenceNextAt",
        "habitId",
        "completedAt",
        "assigneeUserId",
        "position",
        "createdAt",
        "updatedAt",
        "tags",
        "checklist",
        "checklistTotal",
        "checklistDone"
      ],
      "additionalProperties": false
    },
    "spawned": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "listId": {
              "type": "string"
            },
            "parentId": {
              "type": [
                "string",
                "null"
              ]
            },
            "title": {
              "type": "string"
            },
            "descriptionHtml": {
              "type": [
                "string",
                "null"
              ]
            },
            "status": {
              "type": "string",
              "enum": [
                "open",
                "done",
                "trashed"
              ]
            },
            "priority": {
              "type": "string",
              "enum": [
                "none",
                "low",
                "medium",
                "high",
                "urgent"
              ]
            },
            "startAt": {
              "type": [
                "string",
                "null"
              ]
            },
            "endAt": {
              "type": [
                "string",
                "null"
              ]
            },
            "allDay": {
              "type": "boolean"
            },
            "recurrenceRule": {
              "type": [
                "string",
                "null"
              ]
            },
            "recurrenceNextAt": {
              "type": [
                "string",
                "null"
              ]
            },
            "habitId": {
              "type": [
                "string",
                "null"
              ]
            },
            "completedAt": {
              "type": [
                "string",
                "null"
              ]
            },
            "assigneeUserId": {
              "type": [
                "string",
                "null"
              ]
            },
            "position": {
              "type": "number"
            },
            "createdAt": {
              "type": "string"
            },
            "updatedAt": {
              "type": "string"
            },
            "tags": {
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
                  "color": {
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
                  "color",
                  "createdAt"
                ],
                "additionalProperties": false
              }
            },
            "checklist": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "taskId": {
                    "type": "string"
                  },
                  "content": {
                    "type": "string"
                  },
                  "checked": {
                    "type": "boolean"
                  },
                  "position": {
                    "type": "number"
                  }
                },
                "required": [
                  "id",
                  "taskId",
                  "content",
                  "checked",
                  "position"
                ],
                "additionalProperties": false
              }
            },
            "checklistTotal": {
              "type": "number"
            },
            "checklistDone": {
              "type": "number"
            }
          },
          "required": [
            "id",
            "listId",
            "parentId",
            "title",
            "descriptionHtml",
            "status",
            "priority",
            "startAt",
            "endAt",
            "allDay",
            "recurrenceRule",
            "recurrenceNextAt",
            "habitId",
            "completedAt",
            "assigneeUserId",
            "position",
            "createdAt",
            "updatedAt",
            "tags",
            "checklist",
            "checklistTotal",
            "checklistDone"
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
    "task",
    "spawned"
  ],
  "additionalProperties": false
}
```

### `POST /tasks/reorder` — reorderTasks

Manual ordering: place a task between two neighbors (fractional position computed server-side); optionally move it to another list.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "taskId": {
      "type": "string"
    },
    "beforeId": {
      "type": [
        "string",
        "null"
      ]
    },
    "afterId": {
      "type": [
        "string",
        "null"
      ]
    },
    "listId": {
      "type": "string"
    }
  },
  "required": [
    "taskId"
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

### `POST /tasks/:id/checklist` — addChecklistItem

Appends a checklist (subtask) item to a task.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "content": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "id",
    "content"
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
    "taskId": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "checked": {
      "type": "boolean"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "taskId",
    "content",
    "checked",
    "position"
  ],
  "additionalProperties": false
}
```

### `PATCH /checklist/:id` — updateChecklistItem

Edit / toggle / reorder a checklist item.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "checked": {
      "type": "boolean"
    },
    "position": {
      "type": "number"
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
    "taskId": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "checked": {
      "type": "boolean"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "taskId",
    "content",
    "checked",
    "position"
  ],
  "additionalProperties": false
}
```

### `DELETE /checklist/:id` — deleteChecklistItem

Removes a checklist item.

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
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `GET /tags` — listTags

All tags across the caller's active spaces.

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
      "color": {
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
      "color",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /tags` — createTag

Creates a tag in a space (name unique per space).

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "spaceId": {
      "type": "string"
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "spaceId",
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
    "color": {
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
    "color",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /tags/:id` — updateTag

Rename / recolor a tag.

- **Auth**: `session`

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
    "color": {
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
    "color": {
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
    "color",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /tags/:id` — deleteTag

Deletes a tag and its task links.

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
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `GET /overview` — getOverview

Home-page bootstrap: board forest + smart-list counts in one call. Seeds a default board/list when the space is empty (first use).

- **Auth**: `session`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "boards": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/__schema0"
      }
    },
    "counts": {
      "type": "object",
      "properties": {
        "today": {
          "type": "number"
        },
        "tomorrow": {
          "type": "number"
        },
        "week": {
          "type": "number"
        },
        "month": {
          "type": "number"
        },
        "all": {
          "type": "number"
        },
        "completed": {
          "type": "number"
        }
      },
      "required": [
        "today",
        "tomorrow",
        "week",
        "month",
        "all",
        "completed"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "boards",
    "counts"
  ],
  "additionalProperties": false,
  "definitions": {
    "__schema0": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "parentId": {
          "type": [
            "string",
            "null"
          ]
        },
        "name": {
          "type": "string"
        },
        "color": {
          "type": [
            "string",
            "null"
          ]
        },
        "icon": {
          "type": [
            "string",
            "null"
          ]
        },
        "position": {
          "type": "number"
        },
        "collapsed": {
          "type": "boolean"
        },
        "spaceId": {
          "type": "string"
        },
        "createdAt": {
          "type": "string"
        },
        "updatedAt": {
          "type": "string"
        },
        "lists": {
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
              "name": {
                "type": "string"
              },
              "color": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "icon": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "position": {
                "type": "number"
              },
              "openCount": {
                "type": "number"
              },
              "dueTodayCount": {
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
              "boardId",
              "name",
              "color",
              "icon",
              "position",
              "openCount",
              "dueTodayCount",
              "createdAt",
              "updatedAt"
            ],
            "additionalProperties": false
          }
        },
        "children": {
          "type": "array",
          "items": {
            "allOf": [
              {
                "$ref": "#/definitions/__schema0"
              }
            ]
          }
        },
        "openCount": {
          "type": "number"
        },
        "dueTodayCount": {
          "type": "number"
        }
      },
      "required": [
        "id",
        "parentId",
        "name",
        "position",
        "collapsed",
        "spaceId",
        "createdAt",
        "updatedAt",
        "lists",
        "children",
        "openCount",
        "dueTodayCount"
      ],
      "additionalProperties": false
    }
  }
}
```

### `GET /habits` — listHabits

Habits with logs (optionally bounded by date range) and computed streaks.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "from": {
      "type": "string"
    },
    "to": {
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
      "name": {
        "type": "string"
      },
      "color": {
        "type": [
          "string",
          "null"
        ]
      },
      "icon": {
        "type": [
          "string",
          "null"
        ]
      },
      "schedule": {
        "type": "string",
        "enum": [
          "daily",
          "weekly",
          "interval",
          "monthly"
        ]
      },
      "intervalDays": {
        "type": [
          "number",
          "null"
        ]
      },
      "byWeekday": {
        "anyOf": [
          {
            "type": "array",
            "items": {
              "type": "number"
            }
          },
          {
            "type": "null"
          }
        ]
      },
      "targetCount": {
        "type": "number"
      },
      "goalStreak": {
        "type": [
          "number",
          "null"
        ]
      },
      "direction": {
        "type": "string",
        "enum": [
          "build",
          "quit"
        ]
      },
      "createdAt": {
        "type": "string"
      },
      "updatedAt": {
        "type": "string"
      },
      "logs": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "habitId": {
              "type": "string"
            },
            "date": {
              "type": "string"
            },
            "count": {
              "type": "number"
            },
            "note": {
              "type": [
                "string",
                "null"
              ]
            }
          },
          "required": [
            "id",
            "habitId",
            "date",
            "count",
            "note"
          ],
          "additionalProperties": false
        }
      },
      "streak": {
        "type": "number"
      },
      "bestStreak": {
        "type": "number"
      },
      "totalCheckIns": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "name",
      "color",
      "icon",
      "schedule",
      "intervalDays",
      "byWeekday",
      "targetCount",
      "goalStreak",
      "direction",
      "createdAt",
      "updatedAt",
      "logs",
      "streak",
      "bestStreak",
      "totalCheckIns"
    ],
    "additionalProperties": false
  }
}
```

### `POST /habits` — createHabit

Creates a habit tracker.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "spaceId": {
      "type": "string"
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "schedule": {
      "type": "string",
      "enum": [
        "daily",
        "weekly",
        "interval",
        "monthly"
      ]
    },
    "intervalDays": {
      "type": [
        "number",
        "null"
      ]
    },
    "byWeekday": {
      "anyOf": [
        {
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        {
          "type": "null"
        }
      ]
    },
    "targetCount": {
      "type": "number"
    },
    "goalStreak": {
      "type": [
        "number",
        "null"
      ]
    },
    "direction": {
      "type": "string",
      "enum": [
        "build",
        "quit"
      ]
    }
  },
  "required": [
    "spaceId",
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
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "schedule": {
      "type": "string",
      "enum": [
        "daily",
        "weekly",
        "interval",
        "monthly"
      ]
    },
    "intervalDays": {
      "type": [
        "number",
        "null"
      ]
    },
    "byWeekday": {
      "anyOf": [
        {
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        {
          "type": "null"
        }
      ]
    },
    "targetCount": {
      "type": "number"
    },
    "goalStreak": {
      "type": [
        "number",
        "null"
      ]
    },
    "direction": {
      "type": "string",
      "enum": [
        "build",
        "quit"
      ]
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    },
    "logs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "habitId": {
            "type": "string"
          },
          "date": {
            "type": "string"
          },
          "count": {
            "type": "number"
          },
          "note": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "habitId",
          "date",
          "count",
          "note"
        ],
        "additionalProperties": false
      }
    },
    "streak": {
      "type": "number"
    },
    "bestStreak": {
      "type": "number"
    },
    "totalCheckIns": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "name",
    "color",
    "icon",
    "schedule",
    "intervalDays",
    "byWeekday",
    "targetCount",
    "goalStreak",
    "direction",
    "createdAt",
    "updatedAt",
    "logs",
    "streak",
    "bestStreak",
    "totalCheckIns"
  ],
  "additionalProperties": false
}
```

### `PATCH /habits/:id` — updateHabit

Edit a habit (name, schedule, goal, archive…).

- **Auth**: `session`

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
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "schedule": {
      "type": "string",
      "enum": [
        "daily",
        "weekly",
        "interval",
        "monthly"
      ]
    },
    "intervalDays": {
      "type": [
        "number",
        "null"
      ]
    },
    "byWeekday": {
      "anyOf": [
        {
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        {
          "type": "null"
        }
      ]
    },
    "targetCount": {
      "type": "number"
    },
    "goalStreak": {
      "type": [
        "number",
        "null"
      ]
    },
    "direction": {
      "type": "string",
      "enum": [
        "build",
        "quit"
      ]
    },
    "archived": {
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
    "color": {
      "type": [
        "string",
        "null"
      ]
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "schedule": {
      "type": "string",
      "enum": [
        "daily",
        "weekly",
        "interval",
        "monthly"
      ]
    },
    "intervalDays": {
      "type": [
        "number",
        "null"
      ]
    },
    "byWeekday": {
      "anyOf": [
        {
          "type": "array",
          "items": {
            "type": "number"
          }
        },
        {
          "type": "null"
        }
      ]
    },
    "targetCount": {
      "type": "number"
    },
    "goalStreak": {
      "type": [
        "number",
        "null"
      ]
    },
    "direction": {
      "type": "string",
      "enum": [
        "build",
        "quit"
      ]
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    },
    "logs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "habitId": {
            "type": "string"
          },
          "date": {
            "type": "string"
          },
          "count": {
            "type": "number"
          },
          "note": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "habitId",
          "date",
          "count",
          "note"
        ],
        "additionalProperties": false
      }
    },
    "streak": {
      "type": "number"
    },
    "bestStreak": {
      "type": "number"
    },
    "totalCheckIns": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "name",
    "color",
    "icon",
    "schedule",
    "intervalDays",
    "byWeekday",
    "targetCount",
    "goalStreak",
    "direction",
    "createdAt",
    "updatedAt",
    "logs",
    "streak",
    "bestStreak",
    "totalCheckIns"
  ],
  "additionalProperties": false
}
```

### `DELETE /habits/:id` — deleteHabit

Deletes a habit and its logs.

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
      "type": "boolean"
    }
  },
  "required": [
    "ok"
  ],
  "additionalProperties": false
}
```

### `POST /habits/:id/logs` — logHabit

Check in a habit for a day (delta +1/-1; the day's row is upserted, removed at zero).

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "date": {
      "type": "string"
    },
    "delta": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "date",
    "delta"
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
        "id": {
          "type": "string"
        },
        "habitId": {
          "type": "string"
        },
        "date": {
          "type": "string"
        },
        "count": {
          "type": "number"
        },
        "note": {
          "type": [
            "string",
            "null"
          ]
        }
      },
      "required": [
        "id",
        "habitId",
        "date",
        "count",
        "note"
      ],
      "additionalProperties": false
    },
    {
      "type": "null"
    }
  ]
}
```
