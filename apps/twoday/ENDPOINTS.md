# ENDPOINTS.md — TwoDay

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Space-scoped calendars and local events.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twoday`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T17:58:33.745Z_

## Endpoints

### `GET /calendars` — listCalendars

List calendars in accessible spaces.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "spaceId": {
        "type": "string",
        "minLength": 1
      },
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 200
      },
      "color": {
        "default": "#235d42",
        "type": "string",
        "pattern": "^#[0-9a-fA-F]{6}$"
      },
      "id": {
        "type": "string"
      },
      "createdAt": {
        "type": "string"
      }
    },
    "required": [
      "spaceId",
      "name",
      "color",
      "id",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /calendars` — createCalendar

Create a calendar in an accessible space.

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
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "color": {
      "default": "#235d42",
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    }
  },
  "required": [
    "spaceId",
    "name",
    "color"
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
    "spaceId": {
      "type": "string",
      "minLength": 1
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "color": {
      "default": "#235d42",
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "id": {
      "type": "string"
    },
    "createdAt": {
      "type": "string"
    }
  },
  "required": [
    "spaceId",
    "name",
    "color",
    "id",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `GET /events` — listEvents

List overlapping events. Required from/to are YYYY-MM-DD UTC boundaries (to exclusive); optional calendarId, limit (max 500), offset. All-day overlap uses date boundaries.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "note": "could not convert schema to JSON Schema",
  "error": "Error: Transforms cannot be represented in JSON Schema"
}
```

### `POST /events` — createEvent

Create a local event. No invitations are sent. End is exclusive.

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
  "note": "could not convert schema to JSON Schema",
  "error": "Error: Transforms cannot be represented in JSON Schema"
}
```

### `PUT /events/:id` — replaceEvent

Replace event fields; calendarId cannot change.

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
  "note": "could not convert schema to JSON Schema",
  "error": "Error: Transforms cannot be represented in JSON Schema"
}
```

### `DELETE /events/:id` — deleteEvent

Permanently delete a local event.

- **Auth**: `session-or-apiKey`

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
