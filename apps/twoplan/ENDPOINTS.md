# ENDPOINTS.md — TwoPlan

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Project management: Space → Project (KEY) → epics, milestones and tickets. Kanban/table/timeline views, sub-tasks, checklists, links, custom fields, saved views, docs, dashboards, inbox, CSV/Linear import. Workspace-level access.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twoplan`
- **Capabilities**: projects, tickets
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T13:19:06.980Z_

## Endpoints

### `GET /projects` — listProjects

Lists projects in the workspace (optionally one space). Workspace members see every space and project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "spaceId": {
      "type": "string"
    },
    "includeArchived": {
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
      "key": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "icon": {
        "type": [
          "string",
          "null"
        ]
      },
      "pointsEstimateEnabled": {
        "type": "boolean"
      },
      "timeEstimateEnabled": {
        "type": "boolean"
      },
      "subtasksEnabled": {
        "type": "boolean"
      },
      "checklistsEnabled": {
        "type": "boolean"
      },
      "archivedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "type": "string"
      },
      "updatedAt": {
        "type": "string"
      },
      "ticketCount": {
        "type": "number"
      },
      "openTicketCount": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "workspaceId",
      "spaceId",
      "key",
      "name",
      "description",
      "icon",
      "pointsEstimateEnabled",
      "timeEstimateEnabled",
      "subtasksEnabled",
      "checklistsEnabled",
      "archivedAt",
      "createdAt",
      "updatedAt",
      "ticketCount",
      "openTicketCount"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects` — createProject

Creates a project inside a space with a unique key (tickets become KEY-1, KEY-2, …). Seeds the default workflow, or copies a project template's configuration.

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
    },
    "key": {
      "type": "string",
      "pattern": "^[A-Z][A-Z0-9]{1,9}$"
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "description": {
      "type": "string"
    },
    "icon": {
      "type": "string"
    },
    "templateId": {
      "type": "string"
    }
  },
  "required": [
    "spaceId",
    "key",
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
    "workspaceId": {
      "type": "string"
    },
    "spaceId": {
      "type": "string"
    },
    "key": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "pointsEstimateEnabled": {
      "type": "boolean"
    },
    "timeEstimateEnabled": {
      "type": "boolean"
    },
    "subtasksEnabled": {
      "type": "boolean"
    },
    "checklistsEnabled": {
      "type": "boolean"
    },
    "archivedAt": {
      "type": [
        "string",
        "null"
      ]
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
    "key",
    "name",
    "description",
    "icon",
    "pointsEstimateEnabled",
    "timeEstimateEnabled",
    "subtasksEnabled",
    "checklistsEnabled",
    "archivedAt",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `GET /projects/:projectId` — getProject

One project by id or key.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "key": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "pointsEstimateEnabled": {
      "type": "boolean"
    },
    "timeEstimateEnabled": {
      "type": "boolean"
    },
    "subtasksEnabled": {
      "type": "boolean"
    },
    "checklistsEnabled": {
      "type": "boolean"
    },
    "archivedAt": {
      "type": [
        "string",
        "null"
      ]
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
    "key",
    "name",
    "description",
    "icon",
    "pointsEstimateEnabled",
    "timeEstimateEnabled",
    "subtasksEnabled",
    "checklistsEnabled",
    "archivedAt",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId` — updateProject

Renames or reconfigures a project (feature toggles, estimate kinds). The key is immutable.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "description": {
      "type": "string"
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "spaceId": {
      "type": "string"
    },
    "pointsEstimateEnabled": {
      "type": "boolean"
    },
    "timeEstimateEnabled": {
      "type": "boolean"
    },
    "subtasksEnabled": {
      "type": "boolean"
    },
    "checklistsEnabled": {
      "type": "boolean"
    }
  },
  "required": [
    "projectId"
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
    "key": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "pointsEstimateEnabled": {
      "type": "boolean"
    },
    "timeEstimateEnabled": {
      "type": "boolean"
    },
    "subtasksEnabled": {
      "type": "boolean"
    },
    "checklistsEnabled": {
      "type": "boolean"
    },
    "archivedAt": {
      "type": [
        "string",
        "null"
      ]
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
    "key",
    "name",
    "description",
    "icon",
    "pointsEstimateEnabled",
    "timeEstimateEnabled",
    "subtasksEnabled",
    "checklistsEnabled",
    "archivedAt",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `POST /projects/:projectId/archive` — archiveProject

Archives (or restores, with restore=true) a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "restore": {
      "type": "boolean"
    }
  },
  "required": [
    "projectId"
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
    "key": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "icon": {
      "type": [
        "string",
        "null"
      ]
    },
    "pointsEstimateEnabled": {
      "type": "boolean"
    },
    "timeEstimateEnabled": {
      "type": "boolean"
    },
    "subtasksEnabled": {
      "type": "boolean"
    },
    "checklistsEnabled": {
      "type": "boolean"
    },
    "archivedAt": {
      "type": [
        "string",
        "null"
      ]
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
    "key",
    "name",
    "description",
    "icon",
    "pointsEstimateEnabled",
    "timeEstimateEnabled",
    "subtasksEnabled",
    "checklistsEnabled",
    "archivedAt",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId` — deleteProject

Permanently deletes a project and everything in it.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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

### `GET /project-templates` — listProjectTemplates

Project templates of the workspace.

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
      "workspaceId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "createdAt": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "workspaceId",
      "name",
      "description",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/save-as-template` — saveProjectAsTemplate

Snapshots a project's statuses, types, labels, custom fields, settings and ticket templates into a reusable project template.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "description": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "workspaceId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "createdAt": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "workspaceId",
    "name",
    "description",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /project-templates/:id` — deleteProjectTemplate

Deletes a project template (projects created from it are unaffected).

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

### `GET /projects/:projectId/stats` — getProjectStats

Aggregates for dashboards: tickets by status / priority / assignee / type / epic and recent created-vs-completed counts.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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

### `GET /projects/:projectId/statuses` — listStatuses

Lists statuses of a project, ordered by position.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "color": {
        "type": "string"
      },
      "category": {
        "type": "string",
        "enum": [
          "backlog",
          "todo",
          "in_progress",
          "done",
          "canceled"
        ]
      },
      "position": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "projectId",
      "name",
      "color",
      "category",
      "position"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/statuses` — createStatus

Creates a status in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "category": {
      "type": "string",
      "enum": [
        "backlog",
        "todo",
        "in_progress",
        "done",
        "canceled"
      ]
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "category",
    "projectId"
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "color": {
      "type": "string"
    },
    "category": {
      "type": "string",
      "enum": [
        "backlog",
        "todo",
        "in_progress",
        "done",
        "canceled"
      ]
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "color",
    "category",
    "position"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/statuses/:id` — updateStatus

Updates a status.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "category": {
      "type": "string",
      "enum": [
        "backlog",
        "todo",
        "in_progress",
        "done",
        "canceled"
      ]
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "color": {
      "type": "string"
    },
    "category": {
      "type": "string",
      "enum": [
        "backlog",
        "todo",
        "in_progress",
        "done",
        "canceled"
      ]
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "color",
    "category",
    "position"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/statuses/:id` — deleteStatus

Deletes a status.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /projects/:projectId/ticket-types` — listTicketTypes

Lists tickettypes of a project, ordered by position.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "icon": {
        "type": "string"
      },
      "color": {
        "type": "string"
      },
      "position": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "projectId",
      "name",
      "icon",
      "color",
      "position"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/ticket-types` — createTicketType

Creates a tickettype in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "icon": {
      "type": "string"
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "projectId"
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "icon": {
      "type": "string"
    },
    "color": {
      "type": "string"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "icon",
    "color",
    "position"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/ticket-types/:id` — updateTicketType

Updates a tickettype.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "icon": {
      "type": "string"
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "icon": {
      "type": "string"
    },
    "color": {
      "type": "string"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "icon",
    "color",
    "position"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/ticket-types/:id` — deleteTicketType

Deletes a tickettype.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /projects/:projectId/label-groups` — listLabelGroups

Lists labelgroups of a project, ordered by position.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "position": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "projectId",
      "name",
      "position"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/label-groups` — createLabelGroup

Creates a labelgroup in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "projectId"
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "position"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/label-groups/:id` — updateLabelGroup

Updates a labelgroup.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "position"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/label-groups/:id` — deleteLabelGroup

Deletes a labelgroup.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /projects/:projectId/labels` — listLabels

Lists labels of a project, ordered by name.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "groupId": {
        "type": [
          "string",
          "null"
        ]
      },
      "name": {
        "type": "string"
      },
      "color": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "projectId",
      "groupId",
      "name",
      "color"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/labels` — createLabel

Creates a label in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "groupId": {
      "type": [
        "string",
        "null"
      ]
    },
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "projectId"
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
    "projectId": {
      "type": "string"
    },
    "groupId": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "color": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "projectId",
    "groupId",
    "name",
    "color"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/labels/:id` — updateLabel

Updates a label.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "groupId": {
      "type": [
        "string",
        "null"
      ]
    },
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "groupId": {
      "type": [
        "string",
        "null"
      ]
    },
    "name": {
      "type": "string"
    },
    "color": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "projectId",
    "groupId",
    "name",
    "color"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/labels/:id` — deleteLabel

Deletes a label.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /projects/:projectId/custom-fields` — listCustomFields

Lists customfields of a project, ordered by position.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "type": {
        "type": "string",
        "enum": [
          "text",
          "number",
          "date",
          "select",
          "checkbox",
          "url"
        ]
      },
      "position": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "projectId",
      "name",
      "type",
      "position"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/custom-fields` — createCustomField

Creates a customfield in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "type": {
      "type": "string",
      "enum": [
        "text",
        "number",
        "date",
        "select",
        "checkbox",
        "url"
      ]
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "type",
    "projectId"
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "text",
        "number",
        "date",
        "select",
        "checkbox",
        "url"
      ]
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "type",
    "position"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/custom-fields/:id` — updateCustomField

Updates a customfield.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "type": {
      "type": "string",
      "enum": [
        "text",
        "number",
        "date",
        "select",
        "checkbox",
        "url"
      ]
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "type",
    "position"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/custom-fields/:id` — deleteCustomField

Deletes a customfield.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /projects/:projectId/custom-fields/:fieldId/options` — listCustomFieldOptions

Options of a `select` custom field.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "fieldId": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
    "fieldId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "fieldId": {
        "type": "string"
      },
      "label": {
        "type": "string"
      },
      "color": {
        "type": "string"
      },
      "position": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "fieldId",
      "label",
      "color",
      "position"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/custom-fields/:fieldId/options` — createCustomFieldOption

Adds an option to a `select` custom field.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "fieldId": {
      "type": "string"
    },
    "label": {
      "type": "string",
      "minLength": 1
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    }
  },
  "required": [
    "projectId",
    "fieldId",
    "label"
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
    "fieldId": {
      "type": "string"
    },
    "label": {
      "type": "string"
    },
    "color": {
      "type": "string"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "fieldId",
    "label",
    "color",
    "position"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/custom-fields/:fieldId/options/:id` — updateCustomFieldOption

Renames / recolors / reorders a custom-field option.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "fieldId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "label": {
      "type": "string"
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "projectId",
    "fieldId",
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
    "fieldId": {
      "type": "string"
    },
    "label": {
      "type": "string"
    },
    "color": {
      "type": "string"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "fieldId",
    "label",
    "color",
    "position"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/custom-fields/:fieldId/options/:id` — deleteCustomFieldOption

Deletes a custom-field option.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "fieldId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
    "fieldId",
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

### `GET /projects/:projectId/config` — getProjectConfig

Everything the UI needs to render a project in one round trip: statuses, ticket types, label groups, labels, custom fields with options.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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

### `GET /projects/:projectId/tickets` — listTickets

Lists tickets of a project with filters, sorting and pagination. Sub-tasks are included unless parentId=none.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "statusId": {
      "description": "comma-separated status ids",
      "type": "string"
    },
    "statusCategory": {
      "description": "comma-separated: backlog,todo,in_progress,done,canceled",
      "type": "string"
    },
    "assigneeUserId": {
      "description": "user id, comma-separated, or 'none'",
      "type": "string"
    },
    "priority": {
      "description": "comma-separated, or 'none'",
      "type": "string"
    },
    "typeId": {
      "type": "string"
    },
    "epicId": {
      "description": "epic id or 'none'",
      "type": "string"
    },
    "milestoneId": {
      "description": "milestone id or 'none'",
      "type": "string"
    },
    "labelId": {
      "description": "comma-separated; ticket must have ANY",
      "type": "string"
    },
    "parentId": {
      "description": "parent ticket id or 'none' for top-level only",
      "type": "string"
    },
    "q": {
      "description": "title substring or identifier like PLAN-12",
      "type": "string"
    },
    "dueBefore": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "dueAfter": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "archived": {
      "type": "boolean"
    },
    "projectId": {
      "type": "string"
    },
    "sort": {
      "type": "string",
      "enum": [
        "position",
        "createdAt",
        "updatedAt",
        "dueDate",
        "priority",
        "title",
        "sequence"
      ]
    },
    "dir": {
      "type": "string",
      "enum": [
        "asc",
        "desc"
      ]
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1000
    },
    "offset": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    }
  },
  "required": [
    "projectId"
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
          "projectId": {
            "type": "string"
          },
          "identifier": {
            "type": "string"
          },
          "sequenceNumber": {
            "type": "number"
          },
          "typeId": {
            "type": [
              "string",
              "null"
            ]
          },
          "epicId": {
            "type": [
              "string",
              "null"
            ]
          },
          "milestoneId": {
            "type": [
              "string",
              "null"
            ]
          },
          "statusId": {
            "type": "string"
          },
          "parentId": {
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
          "title": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "priority": {
            "anyOf": [
              {
                "type": "string",
                "enum": [
                  "urgent",
                  "high",
                  "medium",
                  "low"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "estimatePoints": {
            "type": [
              "number",
              "null"
            ]
          },
          "estimateMinutes": {
            "type": [
              "number",
              "null"
            ]
          },
          "startDate": {
            "type": [
              "string",
              "null"
            ]
          },
          "dueDate": {
            "type": [
              "string",
              "null"
            ]
          },
          "position": {
            "type": "number"
          },
          "archivedAt": {
            "type": [
              "string",
              "null"
            ]
          },
          "labelIds": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "subtaskCount": {
            "type": "number"
          },
          "subtaskDoneCount": {
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
          "projectId",
          "identifier",
          "sequenceNumber",
          "typeId",
          "epicId",
          "milestoneId",
          "statusId",
          "parentId",
          "assigneeUserId",
          "title",
          "description",
          "priority",
          "estimatePoints",
          "estimateMinutes",
          "startDate",
          "dueDate",
          "position",
          "archivedAt",
          "labelIds",
          "subtaskCount",
          "subtaskDoneCount",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "total": {
      "type": "number"
    }
  },
  "required": [
    "items",
    "total"
  ],
  "additionalProperties": false
}
```

### `POST /projects/:projectId/tickets` — createTicket

Creates a ticket (identifier KEY-n from the project's atomic counter). Defaults to the project's first backlog/todo status. Sub-tasks are one level deep. `templateId` pre-fills from a ticket template.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "title": {
      "default": "",
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "statusId": {
      "type": "string"
    },
    "typeId": {
      "type": [
        "string",
        "null"
      ]
    },
    "epicId": {
      "type": [
        "string",
        "null"
      ]
    },
    "milestoneId": {
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
    "assigneeUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "estimatePoints": {
      "type": [
        "number",
        "null"
      ]
    },
    "estimateMinutes": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "startDate": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        {
          "type": "null"
        }
      ]
    },
    "dueDate": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        {
          "type": "null"
        }
      ]
    },
    "labelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "templateId": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "identifier": {
      "type": "string"
    },
    "sequenceNumber": {
      "type": "number"
    },
    "typeId": {
      "type": [
        "string",
        "null"
      ]
    },
    "epicId": {
      "type": [
        "string",
        "null"
      ]
    },
    "milestoneId": {
      "type": [
        "string",
        "null"
      ]
    },
    "statusId": {
      "type": "string"
    },
    "parentId": {
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
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "estimatePoints": {
      "type": [
        "number",
        "null"
      ]
    },
    "estimateMinutes": {
      "type": [
        "number",
        "null"
      ]
    },
    "startDate": {
      "type": [
        "string",
        "null"
      ]
    },
    "dueDate": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "archivedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "labelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "subtaskCount": {
      "type": "number"
    },
    "subtaskDoneCount": {
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
    "projectId",
    "identifier",
    "sequenceNumber",
    "typeId",
    "epicId",
    "milestoneId",
    "statusId",
    "parentId",
    "assigneeUserId",
    "title",
    "description",
    "priority",
    "estimatePoints",
    "estimateMinutes",
    "startDate",
    "dueDate",
    "position",
    "archivedAt",
    "labelIds",
    "subtaskCount",
    "subtaskDoneCount",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `GET /tickets/:ticketId` — getTicket

Full ticket detail by id or identifier (PLAN-12): relations (epic, milestone, parent, sub-tasks), labels, custom-field values, links, dev links, checklists, watchers, attachments and comments.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    }
  },
  "required": [
    "ticketId"
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

### `PATCH /tickets/:ticketId` — updateTicket

Updates any ticket field (including labels, status, epic, milestone, parent). Every change is written to the activity feed and notifies watchers.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "description": {
      "type": "string"
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "statusId": {
      "type": "string"
    },
    "typeId": {
      "type": [
        "string",
        "null"
      ]
    },
    "epicId": {
      "type": [
        "string",
        "null"
      ]
    },
    "milestoneId": {
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
    "assigneeUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "estimatePoints": {
      "type": [
        "number",
        "null"
      ]
    },
    "estimateMinutes": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": -9007199254740991,
          "maximum": 9007199254740991
        },
        {
          "type": "null"
        }
      ]
    },
    "startDate": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        {
          "type": "null"
        }
      ]
    },
    "dueDate": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        {
          "type": "null"
        }
      ]
    },
    "position": {
      "type": "number"
    },
    "labelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "ticketId": {
      "type": "string"
    }
  },
  "required": [
    "ticketId"
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
    "projectId": {
      "type": "string"
    },
    "identifier": {
      "type": "string"
    },
    "sequenceNumber": {
      "type": "number"
    },
    "typeId": {
      "type": [
        "string",
        "null"
      ]
    },
    "epicId": {
      "type": [
        "string",
        "null"
      ]
    },
    "milestoneId": {
      "type": [
        "string",
        "null"
      ]
    },
    "statusId": {
      "type": "string"
    },
    "parentId": {
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
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "estimatePoints": {
      "type": [
        "number",
        "null"
      ]
    },
    "estimateMinutes": {
      "type": [
        "number",
        "null"
      ]
    },
    "startDate": {
      "type": [
        "string",
        "null"
      ]
    },
    "dueDate": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "archivedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "labelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "subtaskCount": {
      "type": "number"
    },
    "subtaskDoneCount": {
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
    "projectId",
    "identifier",
    "sequenceNumber",
    "typeId",
    "epicId",
    "milestoneId",
    "statusId",
    "parentId",
    "assigneeUserId",
    "title",
    "description",
    "priority",
    "estimatePoints",
    "estimateMinutes",
    "startDate",
    "dueDate",
    "position",
    "archivedAt",
    "labelIds",
    "subtaskCount",
    "subtaskDoneCount",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `POST /tickets/:ticketId/archive` — archiveTicket

Archives (or restores, restore=true) a ticket; archived tickets are hidden from boards and lists.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "restore": {
      "type": "boolean"
    }
  },
  "required": [
    "ticketId"
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

### `DELETE /tickets/:ticketId` — deleteTicket

Permanently deletes a ticket. Its sub-tasks are detached (become top-level), not deleted.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    }
  },
  "required": [
    "ticketId"
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

### `POST /projects/:projectId/tickets/bulk` — bulkUpdateTickets

Applies one patch (status, assignee, priority, epic, milestone, labels to add/remove) or archive/delete to many tickets at once.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "ticketIds": {
      "minItems": 1,
      "maxItems": 500,
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "action": {
      "default": "update",
      "type": "string",
      "enum": [
        "update",
        "archive",
        "delete"
      ]
    },
    "patch": {
      "type": "object",
      "properties": {
        "statusId": {
          "type": "string"
        },
        "assigneeUserId": {
          "type": [
            "string",
            "null"
          ]
        },
        "priority": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "urgent",
                "high",
                "medium",
                "low"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "epicId": {
          "type": [
            "string",
            "null"
          ]
        },
        "milestoneId": {
          "type": [
            "string",
            "null"
          ]
        },
        "typeId": {
          "type": [
            "string",
            "null"
          ]
        }
      },
      "additionalProperties": false
    },
    "addLabelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "removeLabelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "projectId",
    "ticketIds",
    "action"
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
    "count": {
      "type": "number"
    }
  },
  "required": [
    "ok",
    "count"
  ],
  "additionalProperties": false
}
```

### `POST /tickets/:ticketId/comments` — createComment

Adds a comment (markdown/HTML from the editor). The author auto-watches the ticket; watchers are notified.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "body": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "ticketId",
    "body"
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

### `PATCH /tickets/:ticketId/comments/:id` — updateComment

Edits your own comment.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "body": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "ticketId",
    "id",
    "body"
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

### `DELETE /tickets/:ticketId/comments/:id` — deleteComment

Deletes your own comment.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "ticketId",
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

### `GET /tickets/:ticketId/activity` — listTicketActivity

Chronological activity feed (field changes, comments, created/archived).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    }
  },
  "required": [
    "ticketId"
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

### `PUT /tickets/:ticketId/watch` — watchTicket

Subscribes (watching=true) or unsubscribes the caller to a ticket's notifications.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "watching": {
      "default": true,
      "type": "boolean"
    }
  },
  "required": [
    "ticketId",
    "watching"
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

### `POST /tickets/:ticketId/checklists` — createChecklist

Adds a checklist to a ticket.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "title": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "ticketId",
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `PATCH /tickets/:ticketId/checklists/:id` — updateChecklist

Renames or reorders a checklist.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "ticketId",
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /tickets/:ticketId/checklists/:id` — deleteChecklist

Deletes a checklist and its items.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "ticketId",
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

### `POST /tickets/:ticketId/checklists/:checklistId/items` — createChecklistItem

Adds an item to a checklist.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "checklistId": {
      "type": "string"
    },
    "text": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "ticketId",
    "checklistId",
    "text"
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

### `PATCH /tickets/:ticketId/checklist-items/:id` — updateChecklistItem

Edits, toggles (done) or reorders a checklist item.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "text": {
      "type": "string"
    },
    "done": {
      "type": "boolean"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "ticketId",
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /tickets/:ticketId/checklist-items/:id` — deleteChecklistItem

Deletes a checklist item.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "ticketId",
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

### `POST /tickets/:ticketId/links` — createTicketLink

Links this ticket to another one in the same workspace: blocks (this blocks target), relates_to, duplicates (this duplicates target).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "targetTicketId": {
      "type": "string"
    },
    "relation": {
      "type": "string",
      "enum": [
        "blocks",
        "relates_to",
        "duplicates"
      ]
    }
  },
  "required": [
    "ticketId",
    "targetTicketId",
    "relation"
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

### `DELETE /tickets/:ticketId/links/:id` — deleteTicketLink

Removes a ticket link.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "ticketId",
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

### `PUT /tickets/:ticketId/fields/:fieldId` — setTicketFieldValue

Sets (or clears with value=null) a custom-field value. Validated against the field type; select values must be an option id.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "fieldId": {
      "type": "string"
    },
    "value": {
      "anyOf": [
        {},
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "ticketId",
    "fieldId",
    "value"
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

### `POST /tickets/:ticketId/dev-links` — createDevLink

Attaches a pull request / branch / commit URL with its state and CI status (set manually or by an external caller).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "url": {
      "type": "string",
      "format": "uri"
    },
    "provider": {
      "type": "string"
    },
    "kind": {
      "type": "string",
      "enum": [
        "pull_request",
        "branch",
        "commit"
      ]
    },
    "title": {
      "type": "string"
    },
    "state": {
      "type": "string",
      "enum": [
        "open",
        "draft",
        "merged",
        "closed"
      ]
    },
    "ciState": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "pending",
            "success",
            "failure"
          ]
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "ticketId",
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `PATCH /tickets/:ticketId/dev-links/:id` — updateDevLink

Updates a dev link's title, state or CI status.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "state": {
      "type": "string",
      "enum": [
        "open",
        "draft",
        "merged",
        "closed"
      ]
    },
    "ciState": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "pending",
            "success",
            "failure"
          ]
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "ticketId",
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /tickets/:ticketId/dev-links/:id` — deleteDevLink

Removes a dev link.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "ticketId",
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

### `POST /tickets/:ticketId/attachments` — uploadAttachment

Uploads a file as the raw request body (Content-Type = file type). Query: ?fileName=<name>. Max 25 MB.

- **Auth**: `session-or-apiKey`

### `GET /tickets/:ticketId/attachments/:id` — downloadAttachment

Downloads an attachment (binary).

- **Auth**: `session-or-apiKey`

### `DELETE /tickets/:ticketId/attachments/:id` — deleteAttachment

Deletes an attachment and its blob.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "ticketId",
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

### `POST /projects/:projectId/epics` — createEpic

Creates a epic in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "description": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "proposed",
        "planned",
        "active",
        "completed",
        "canceled"
      ]
    },
    "ownerUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "startDate": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        {
          "type": "null"
        }
      ]
    },
    "targetDate": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        {
          "type": "null"
        }
      ]
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "title",
    "projectId"
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
    "projectId": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "proposed",
        "planned",
        "active",
        "completed",
        "canceled"
      ]
    },
    "ownerUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "startDate": {
      "type": [
        "string",
        "null"
      ]
    },
    "targetDate": {
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
    }
  },
  "required": [
    "id",
    "projectId",
    "title",
    "description",
    "status",
    "ownerUserId",
    "priority",
    "startDate",
    "targetDate",
    "position",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/epics/:id` — updateEpic

Updates a epic.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "description": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "proposed",
        "planned",
        "active",
        "completed",
        "canceled"
      ]
    },
    "ownerUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "startDate": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        {
          "type": "null"
        }
      ]
    },
    "targetDate": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        {
          "type": "null"
        }
      ]
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "proposed",
        "planned",
        "active",
        "completed",
        "canceled"
      ]
    },
    "ownerUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "startDate": {
      "type": [
        "string",
        "null"
      ]
    },
    "targetDate": {
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
    }
  },
  "required": [
    "id",
    "projectId",
    "title",
    "description",
    "status",
    "ownerUserId",
    "priority",
    "startDate",
    "targetDate",
    "position",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/epics/:id` — deleteEpic

Deletes a epic.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /projects/:projectId/epics` — listEpics

Epics of a project with ticket progress rollups and labels.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "status": {
        "type": "string",
        "enum": [
          "proposed",
          "planned",
          "active",
          "completed",
          "canceled"
        ]
      },
      "ownerUserId": {
        "type": [
          "string",
          "null"
        ]
      },
      "priority": {
        "anyOf": [
          {
            "type": "string",
            "enum": [
              "urgent",
              "high",
              "medium",
              "low"
            ]
          },
          {
            "type": "null"
          }
        ]
      },
      "startDate": {
        "type": [
          "string",
          "null"
        ]
      },
      "targetDate": {
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
      "progress": {
        "type": "object",
        "properties": {
          "total": {
            "type": "number"
          },
          "done": {
            "type": "number"
          },
          "canceled": {
            "type": "number"
          },
          "inProgress": {
            "type": "number"
          },
          "points": {
            "type": "number"
          },
          "donePoints": {
            "type": "number"
          }
        },
        "required": [
          "total",
          "done",
          "canceled",
          "inProgress",
          "points",
          "donePoints"
        ],
        "additionalProperties": false
      },
      "labelIds": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "id",
      "projectId",
      "title",
      "description",
      "status",
      "ownerUserId",
      "priority",
      "startDate",
      "targetDate",
      "position",
      "createdAt",
      "updatedAt",
      "progress",
      "labelIds"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/milestones` — createMilestone

Creates a milestone in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "goal": {
      "type": "string"
    },
    "startDate": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "endDate": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "startDate",
    "endDate",
    "projectId"
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "goal": {
      "type": "string"
    },
    "startDate": {
      "type": "string"
    },
    "endDate": {
      "type": "string"
    },
    "completedAt": {
      "type": [
        "string",
        "null"
      ]
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
    "projectId",
    "name",
    "goal",
    "startDate",
    "endDate",
    "completedAt",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/milestones/:id` — updateMilestone

Updates a milestone.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "goal": {
      "type": "string"
    },
    "startDate": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "endDate": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "goal": {
      "type": "string"
    },
    "startDate": {
      "type": "string"
    },
    "endDate": {
      "type": "string"
    },
    "completedAt": {
      "type": [
        "string",
        "null"
      ]
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
    "projectId",
    "name",
    "goal",
    "startDate",
    "endDate",
    "completedAt",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/milestones/:id` — deleteMilestone

Deletes a milestone.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /projects/:projectId/milestones` — listMilestones

Milestones (sprint-like, time-boxed) with progress and a derived state: upcoming | active | completed.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "goal": {
        "type": "string"
      },
      "startDate": {
        "type": "string"
      },
      "endDate": {
        "type": "string"
      },
      "completedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "type": "string"
      },
      "updatedAt": {
        "type": "string"
      },
      "progress": {
        "type": "object",
        "properties": {
          "total": {
            "type": "number"
          },
          "done": {
            "type": "number"
          },
          "canceled": {
            "type": "number"
          },
          "inProgress": {
            "type": "number"
          },
          "points": {
            "type": "number"
          },
          "donePoints": {
            "type": "number"
          }
        },
        "required": [
          "total",
          "done",
          "canceled",
          "inProgress",
          "points",
          "donePoints"
        ],
        "additionalProperties": false
      },
      "state": {
        "type": "string",
        "enum": [
          "upcoming",
          "active",
          "completed"
        ]
      }
    },
    "required": [
      "id",
      "projectId",
      "name",
      "goal",
      "startDate",
      "endDate",
      "completedAt",
      "createdAt",
      "updatedAt",
      "progress",
      "state"
    ],
    "additionalProperties": false
  }
}
```

### `GET /projects/:projectId/epics/:id` — getEpic

One epic with progress and labels.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": [
        "proposed",
        "planned",
        "active",
        "completed",
        "canceled"
      ]
    },
    "ownerUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "startDate": {
      "type": [
        "string",
        "null"
      ]
    },
    "targetDate": {
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
    "progress": {
      "type": "object",
      "properties": {
        "total": {
          "type": "number"
        },
        "done": {
          "type": "number"
        },
        "canceled": {
          "type": "number"
        },
        "inProgress": {
          "type": "number"
        },
        "points": {
          "type": "number"
        },
        "donePoints": {
          "type": "number"
        }
      },
      "required": [
        "total",
        "done",
        "canceled",
        "inProgress",
        "points",
        "donePoints"
      ],
      "additionalProperties": false
    },
    "labelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "id",
    "projectId",
    "title",
    "description",
    "status",
    "ownerUserId",
    "priority",
    "startDate",
    "targetDate",
    "position",
    "createdAt",
    "updatedAt",
    "progress",
    "labelIds"
  ],
  "additionalProperties": false
}
```

### `PUT /projects/:projectId/epics/:id/labels` — setEpicLabels

Replaces an epic's labels.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "labelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "projectId",
    "id",
    "labelIds"
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

### `POST /projects/:projectId/milestones/:id/complete` — completeMilestone

Finishes a milestone early (sets completedAt; endDate stays the planned date). With moveOpenTo, unfinished tickets roll over to another milestone (or to none with moveOpenTo=null). reopen=true clears completion.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "reopen": {
      "type": "boolean"
    },
    "moveOpenTo": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "goal": {
      "type": "string"
    },
    "startDate": {
      "type": "string"
    },
    "endDate": {
      "type": "string"
    },
    "completedAt": {
      "type": [
        "string",
        "null"
      ]
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
    "projectId",
    "name",
    "goal",
    "startDate",
    "endDate",
    "completedAt",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `GET /projects/:projectId/timeline` — getTimeline

Data for the timeline (gantt) view: epics, milestones and dated tickets with their date ranges, grouped by epic. Tickets without any date are omitted.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "epics": {
      "type": "array",
      "items": {}
    },
    "milestones": {
      "type": "array",
      "items": {}
    },
    "tickets": {
      "type": "array",
      "items": {}
    }
  },
  "required": [
    "epics",
    "milestones",
    "tickets"
  ],
  "additionalProperties": false
}
```

### `GET /projects/:projectId/views` — listViews

Lists views of a project, ordered by position.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "layout": {
        "type": "string"
      },
      "filters": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      },
      "sortBy": {
        "type": "string"
      },
      "sortDir": {
        "type": "string"
      },
      "groupBy": {
        "type": [
          "string",
          "null"
        ]
      },
      "ownerUserId": {
        "type": [
          "string",
          "null"
        ]
      },
      "shared": {
        "type": "boolean"
      },
      "position": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "projectId",
      "name",
      "layout",
      "filters",
      "sortBy",
      "sortDir",
      "groupBy",
      "ownerUserId",
      "shared",
      "position"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/views` — createView

Creates a view in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "layout": {
      "type": "string",
      "enum": [
        "table",
        "board",
        "timeline"
      ]
    },
    "filters": {
      "type": "object",
      "properties": {
        "statusId": {
          "description": "comma-separated status ids",
          "type": "string"
        },
        "statusCategory": {
          "description": "comma-separated: backlog,todo,in_progress,done,canceled",
          "type": "string"
        },
        "assigneeUserId": {
          "description": "user id, comma-separated, or 'none'",
          "type": "string"
        },
        "priority": {
          "description": "comma-separated, or 'none'",
          "type": "string"
        },
        "typeId": {
          "type": "string"
        },
        "epicId": {
          "description": "epic id or 'none'",
          "type": "string"
        },
        "milestoneId": {
          "description": "milestone id or 'none'",
          "type": "string"
        },
        "labelId": {
          "description": "comma-separated; ticket must have ANY",
          "type": "string"
        },
        "parentId": {
          "description": "parent ticket id or 'none' for top-level only",
          "type": "string"
        },
        "q": {
          "description": "title substring or identifier like PLAN-12",
          "type": "string"
        },
        "dueBefore": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "dueAfter": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "archived": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    },
    "sortBy": {
      "type": "string",
      "enum": [
        "position",
        "createdAt",
        "updatedAt",
        "dueDate",
        "priority",
        "title",
        "sequence"
      ]
    },
    "sortDir": {
      "type": "string",
      "enum": [
        "asc",
        "desc"
      ]
    },
    "groupBy": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "status",
            "assignee",
            "priority",
            "epic",
            "milestone",
            "type"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "shared": {
      "type": "boolean"
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "projectId"
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "layout": {
      "type": "string"
    },
    "filters": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    },
    "sortBy": {
      "type": "string"
    },
    "sortDir": {
      "type": "string"
    },
    "groupBy": {
      "type": [
        "string",
        "null"
      ]
    },
    "ownerUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "shared": {
      "type": "boolean"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "layout",
    "filters",
    "sortBy",
    "sortDir",
    "groupBy",
    "ownerUserId",
    "shared",
    "position"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/views/:id` — updateView

Updates a view.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "layout": {
      "type": "string",
      "enum": [
        "table",
        "board",
        "timeline"
      ]
    },
    "filters": {
      "type": "object",
      "properties": {
        "statusId": {
          "description": "comma-separated status ids",
          "type": "string"
        },
        "statusCategory": {
          "description": "comma-separated: backlog,todo,in_progress,done,canceled",
          "type": "string"
        },
        "assigneeUserId": {
          "description": "user id, comma-separated, or 'none'",
          "type": "string"
        },
        "priority": {
          "description": "comma-separated, or 'none'",
          "type": "string"
        },
        "typeId": {
          "type": "string"
        },
        "epicId": {
          "description": "epic id or 'none'",
          "type": "string"
        },
        "milestoneId": {
          "description": "milestone id or 'none'",
          "type": "string"
        },
        "labelId": {
          "description": "comma-separated; ticket must have ANY",
          "type": "string"
        },
        "parentId": {
          "description": "parent ticket id or 'none' for top-level only",
          "type": "string"
        },
        "q": {
          "description": "title substring or identifier like PLAN-12",
          "type": "string"
        },
        "dueBefore": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "dueAfter": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "archived": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    },
    "sortBy": {
      "type": "string",
      "enum": [
        "position",
        "createdAt",
        "updatedAt",
        "dueDate",
        "priority",
        "title",
        "sequence"
      ]
    },
    "sortDir": {
      "type": "string",
      "enum": [
        "asc",
        "desc"
      ]
    },
    "groupBy": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "status",
            "assignee",
            "priority",
            "epic",
            "milestone",
            "type"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "shared": {
      "type": "boolean"
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "layout": {
      "type": "string"
    },
    "filters": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    },
    "sortBy": {
      "type": "string"
    },
    "sortDir": {
      "type": "string"
    },
    "groupBy": {
      "type": [
        "string",
        "null"
      ]
    },
    "ownerUserId": {
      "type": [
        "string",
        "null"
      ]
    },
    "shared": {
      "type": "boolean"
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "layout",
    "filters",
    "sortBy",
    "sortDir",
    "groupBy",
    "ownerUserId",
    "shared",
    "position"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/views/:id` — deleteView

Deletes a view.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /projects/:projectId/documents` — listDocuments

Lists documents of a project, ordered by position.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
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
      "title": {
        "type": "string"
      },
      "content": {
        "type": "string"
      },
      "createdBy": {
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
      }
    },
    "required": [
      "id",
      "projectId",
      "kind",
      "parentId",
      "title",
      "content",
      "createdBy",
      "position",
      "createdAt",
      "updatedAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/documents` — createDocument

Creates a document in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "kind": {
      "type": "string",
      "enum": [
        "doc",
        "note"
      ]
    },
    "content": {
      "type": "string"
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
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "title",
    "projectId"
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
    "projectId": {
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
    "title": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "createdBy": {
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
    }
  },
  "required": [
    "id",
    "projectId",
    "kind",
    "parentId",
    "title",
    "content",
    "createdBy",
    "position",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/documents/:id` — updateDocument

Updates a document.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1
    },
    "kind": {
      "type": "string",
      "enum": [
        "doc",
        "note"
      ]
    },
    "content": {
      "type": "string"
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
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
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
    "title": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "createdBy": {
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
    }
  },
  "required": [
    "id",
    "projectId",
    "kind",
    "parentId",
    "title",
    "content",
    "createdBy",
    "position",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/documents/:id` — deleteDocument

Deletes a document.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /projects/:projectId/dashboards` — listDashboards

Lists dashboards of a project, ordered by position.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "widgets": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "type": {
              "type": "string",
              "enum": [
                "by_status",
                "by_priority",
                "by_assignee",
                "by_type",
                "by_epic",
                "by_milestone",
                "created_vs_completed",
                "overdue",
                "milestone_progress"
              ]
            },
            "title": {
              "type": "string"
            },
            "size": {
              "type": "string",
              "enum": [
                "sm",
                "md",
                "lg"
              ]
            }
          },
          "required": [
            "id",
            "type"
          ],
          "additionalProperties": false
        }
      },
      "position": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "projectId",
      "name",
      "widgets",
      "position"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/dashboards` — createDashboard

Creates a dashboard in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "widgets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "by_status",
              "by_priority",
              "by_assignee",
              "by_type",
              "by_epic",
              "by_milestone",
              "created_vs_completed",
              "overdue",
              "milestone_progress"
            ]
          },
          "title": {
            "type": "string"
          },
          "size": {
            "type": "string",
            "enum": [
              "sm",
              "md",
              "lg"
            ]
          }
        },
        "required": [
          "id",
          "type"
        ],
        "additionalProperties": false
      }
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "projectId"
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "widgets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "by_status",
              "by_priority",
              "by_assignee",
              "by_type",
              "by_epic",
              "by_milestone",
              "created_vs_completed",
              "overdue",
              "milestone_progress"
            ]
          },
          "title": {
            "type": "string"
          },
          "size": {
            "type": "string",
            "enum": [
              "sm",
              "md",
              "lg"
            ]
          }
        },
        "required": [
          "id",
          "type"
        ],
        "additionalProperties": false
      }
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "widgets",
    "position"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/dashboards/:id` — updateDashboard

Updates a dashboard.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "widgets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "by_status",
              "by_priority",
              "by_assignee",
              "by_type",
              "by_epic",
              "by_milestone",
              "created_vs_completed",
              "overdue",
              "milestone_progress"
            ]
          },
          "title": {
            "type": "string"
          },
          "size": {
            "type": "string",
            "enum": [
              "sm",
              "md",
              "lg"
            ]
          }
        },
        "required": [
          "id",
          "type"
        ],
        "additionalProperties": false
      }
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "widgets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "enum": [
              "by_status",
              "by_priority",
              "by_assignee",
              "by_type",
              "by_epic",
              "by_milestone",
              "created_vs_completed",
              "overdue",
              "milestone_progress"
            ]
          },
          "title": {
            "type": "string"
          },
          "size": {
            "type": "string",
            "enum": [
              "sm",
              "md",
              "lg"
            ]
          }
        },
        "required": [
          "id",
          "type"
        ],
        "additionalProperties": false
      }
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "widgets",
    "position"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/dashboards/:id` — deleteDashboard

Deletes a dashboard.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /projects/:projectId/ticket-templates` — listTicketTemplates

Lists tickettemplates of a project, ordered by position.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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
    "properties": {
      "id": {
        "type": "string"
      },
      "projectId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "typeId": {
        "type": [
          "string",
          "null"
        ]
      },
      "priority": {
        "type": [
          "string",
          "null"
        ]
      },
      "labelIds": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "checklist": {
        "type": "array",
        "items": {}
      },
      "position": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "projectId",
      "name",
      "title",
      "description",
      "typeId",
      "priority",
      "labelIds",
      "checklist",
      "position"
    ],
    "additionalProperties": false
  }
}
```

### `POST /projects/:projectId/ticket-templates` — createTicketTemplate

Creates a tickettemplate in a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "typeId": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "labelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string"
          },
          "items": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "title",
          "items"
        ],
        "additionalProperties": false
      }
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "name",
    "projectId"
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "typeId": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "type": [
        "string",
        "null"
      ]
    },
    "labelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "checklist": {
      "type": "array",
      "items": {}
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "title",
    "description",
    "typeId",
    "priority",
    "labelIds",
    "checklist",
    "position"
  ],
  "additionalProperties": false
}
```

### `PATCH /projects/:projectId/ticket-templates/:id` — updateTicketTemplate

Updates a tickettemplate.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "typeId": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "urgent",
            "high",
            "medium",
            "low"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "labelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string"
          },
          "items": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "title",
          "items"
        ],
        "additionalProperties": false
      }
    },
    "position": {
      "type": "number"
    },
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "projectId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "typeId": {
      "type": [
        "string",
        "null"
      ]
    },
    "priority": {
      "type": [
        "string",
        "null"
      ]
    },
    "labelIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "checklist": {
      "type": "array",
      "items": {}
    },
    "position": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "projectId",
    "name",
    "title",
    "description",
    "typeId",
    "priority",
    "labelIds",
    "checklist",
    "position"
  ],
  "additionalProperties": false
}
```

### `DELETE /projects/:projectId/ticket-templates/:id` — deleteTicketTemplate

Deletes a tickettemplate.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `PUT /projects/:projectId/documents/:id/tickets` — setDocumentTickets

Replaces the tickets a document is linked to.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    },
    "ticketIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "projectId",
    "id",
    "ticketIds"
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

### `GET /tickets/:ticketId/documents` — listTicketDocuments

Documents/notes linked to a ticket.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ticketId": {
      "type": "string"
    }
  },
  "required": [
    "ticketId"
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

### `GET /projects/:projectId/documents/:id/tickets` — getDocumentTickets

Ticket ids a document is linked to.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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
    "ticketIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "ticketIds"
  ],
  "additionalProperties": false
}
```

### `GET /notifications` — listNotifications

Caller's inbox, newest first. unread=true filters to unread.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "unread": {
      "type": "boolean"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 200
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
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      }
    },
    "unreadCount": {
      "type": "number"
    }
  },
  "required": [
    "items",
    "unreadCount"
  ],
  "additionalProperties": false
}
```

### `POST /notifications/read` — markNotificationsRead

Marks the given notifications (or all, with all=true) as read.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "ids": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "all": {
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

### `GET /my/tickets` — listMyTickets

Open tickets assigned to the caller across all projects in the workspace (or tickets they watch, with scope=watching).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "scope": {
      "type": "string",
      "enum": [
        "assigned",
        "watching",
        "created"
      ]
    },
    "includeDone": {
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

### `GET /search` — searchWorkspace

Command-palette search: projects (name/key), tickets (title or identifier) and epics (title) across the whole workspace.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "q": {
      "type": "string",
      "minLength": 1
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 50
    }
  },
  "required": [
    "q"
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
    "projects": {
      "type": "array",
      "items": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      }
    },
    "tickets": {
      "type": "array",
      "items": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      }
    },
    "epics": {
      "type": "array",
      "items": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      }
    }
  },
  "required": [
    "projects",
    "tickets",
    "epics"
  ],
  "additionalProperties": false
}
```

### `GET /preferences/:key` — getPreference

Reads a per-user UI preference (opaque JSON).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "key": {
      "type": "string"
    }
  },
  "required": [
    "key"
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

### `PUT /preferences/:key` — setPreference

Writes a per-user UI preference.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "key": {
      "type": "string"
    },
    "value": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    }
  },
  "required": [
    "key",
    "value"
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

### `POST /projects/:projectId/share` — createShareLink

Creates a read-only public link for a project board, or for a single ticket (ticketId). The token is the only credential.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "ticketId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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

### `GET /projects/:projectId/share` — listShareLinks

Active share links of a project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    }
  },
  "required": [
    "projectId"
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

### `DELETE /projects/:projectId/share/:id` — revokeShareLink

Revokes a share link immediately.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  },
  "required": [
    "projectId",
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

### `GET /public/:token` — getPublicShare

Public, unauthenticated, read-only view for a share token: project board (statuses + tickets) or a single ticket with comments and checklists. No user ids are exposed.

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
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `GET /projects/:projectId/export` — exportTickets

Exports a project's tickets (honouring the listTickets filters) as CSV (default) or JSON. Names, not ids, so the file round-trips through importTicketsCsv.

- **Auth**: `session-or-apiKey`

### `POST /projects/:projectId/import/csv` — importTicketsCsv

Imports tickets from CSV text. Header row required; recognised columns: title (required), description, status, type, priority, assignee, epic, milestone, labels (| separated), points, estimateMinutes, startDate, dueDate. Status/type/epic/milestone are matched by name; unknown labels and epics are created. Rows that fail are reported, the rest import.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "csv": {
      "type": "string",
      "minLength": 1
    },
    "createMissing": {
      "default": true,
      "type": "boolean"
    }
  },
  "required": [
    "projectId",
    "csv",
    "createMissing"
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
    "imported": {
      "type": "number"
    },
    "failed": {
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
    }
  },
  "required": [
    "imported",
    "failed"
  ],
  "additionalProperties": false
}
```

### `POST /projects/:projectId/import/linear` — importFromLinear

One-shot import of a Linear team: workflow states -> statuses (by name, created if missing), labels, issues (priority/estimate/dates/parent), Linear cycles -> milestones, Linear projects -> epics. The API key is used for this request only and never stored. Re-running skips nothing, so import into a fresh project.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string"
    },
    "apiKey": {
      "type": "string",
      "minLength": 10
    },
    "teamKey": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "projectId",
    "apiKey",
    "teamKey"
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
    "tickets": {
      "type": "number"
    },
    "epics": {
      "type": "number"
    },
    "milestones": {
      "type": "number"
    },
    "labels": {
      "type": "number"
    }
  },
  "required": [
    "tickets",
    "epics",
    "milestones",
    "labels"
  ],
  "additionalProperties": false
}
```

### `GET /internal/manifest` — internalManifest

Pull-registration endpoint TwoDB's orchestrator polls on this app's published port. Guarded by the per-app registration token (`x-registration-token`) — not callable through the Gateway.

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
    "httpUrl": {
      "type": "string"
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
