# ENDPOINTS.md — TwoContacts

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Space-scoped address books and contacts with search and recipient suggestions.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twocontacts`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T17:48:54.765Z_

## Endpoints

### `GET /books` — listBooks

List address books in accessible spaces.

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
      "id",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /books` — createBook

Create an address book in an accessible space.

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
    "spaceId": {
      "type": "string",
      "minLength": 1
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
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
    "id",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `GET /contacts` — listContacts

Search accessible contacts; query: bookId, q, limit (1–200), offset.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "note": "could not convert schema to JSON Schema",
  "error": "Error: Transforms cannot be represented in JSON Schema"
}
```

### `GET /contacts/suggest` — suggestContacts

Recipient suggestions using q and optional bookId; pinned contacts first, maximum 10.

- **Auth**: `session-or-apiKey`

**Response**
```json
{
  "note": "could not convert schema to JSON Schema",
  "error": "Error: Transforms cannot be represented in JSON Schema"
}
```

### `POST /contacts` — createContact

Create a contact; normalized email must be unique in its book.

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

### `PATCH /contacts/:id` — updateContact

Edit a contact in an accessible address book.

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

### `DELETE /contacts/:id` — deleteContact

Permanently delete a contact in an accessible address book.

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
