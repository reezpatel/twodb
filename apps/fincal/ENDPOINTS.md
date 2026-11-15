# ENDPOINTS.md — Fincal

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Personal finance per space: accounts (bank/cash/UPI/credit card), expenses, budgets, envelopes, goals, investments (stocks, mutual funds, metals, FDs, RDs, …), net-worth tracker, retirement planner, analytics and calculators. Workspace-level access.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/fincal`
- **Capabilities**: finance, budgets, investments
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-15T18:32:44.515Z_

## Endpoints

### `GET /accounts` — listAccounts

Accounts of a space with live balance. Credit cards add due / available / utilizationPct (balance is negative when money is owed).

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
    "includeArchived": {
      "type": "boolean"
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

### `POST /accounts` — createAccount

Creates account in a space.

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
      "maxLength": 80
    },
    "type": {
      "type": "string",
      "enum": [
        "bank",
        "cash",
        "upi",
        "credit_card",
        "wallet",
        "other"
      ]
    },
    "institution": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 80
        },
        {
          "type": "null"
        }
      ]
    },
    "openingBalance": {
      "type": "number"
    },
    "creditLimit": {
      "type": [
        "number",
        "null"
      ]
    },
    "statementDay": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": 1,
          "maximum": 31
        },
        {
          "type": "null"
        }
      ]
    },
    "dueDay": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": 1,
          "maximum": 31
        },
        {
          "type": "null"
        }
      ]
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "includeInNetworth": {
      "type": "boolean"
    }
  },
  "required": [
    "spaceId",
    "name",
    "type"
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

### `PATCH /accounts/:id` — updateAccount

Updates account.

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
      "type": "string",
      "minLength": 1,
      "maxLength": 80
    },
    "type": {
      "type": "string",
      "enum": [
        "bank",
        "cash",
        "upi",
        "credit_card",
        "wallet",
        "other"
      ]
    },
    "institution": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 80
        },
        {
          "type": "null"
        }
      ]
    },
    "openingBalance": {
      "type": "number"
    },
    "creditLimit": {
      "type": [
        "number",
        "null"
      ]
    },
    "statementDay": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": 1,
          "maximum": 31
        },
        {
          "type": "null"
        }
      ]
    },
    "dueDay": {
      "anyOf": [
        {
          "type": "integer",
          "minimum": 1,
          "maximum": 31
        },
        {
          "type": "null"
        }
      ]
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "includeInNetworth": {
      "type": "boolean"
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /accounts/:id` — deleteAccount

Deletes account. Fails with 409 if still referenced.

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

### `GET /categories` — listCategories

Income/expense categories of a space (default set is seeded on first use).

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
    "kind": {
      "type": "string",
      "enum": [
        "expense",
        "income"
      ]
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

### `POST /categories` — createCategory

Creates categorie in a space.

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
      "maxLength": 60
    },
    "kind": {
      "type": "string",
      "enum": [
        "expense",
        "income"
      ]
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    }
  },
  "required": [
    "spaceId",
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `PATCH /categories/:id` — updateCategory

Updates categorie.

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
      "type": "string",
      "minLength": 1,
      "maxLength": 60
    },
    "kind": {
      "type": "string",
      "enum": [
        "expense",
        "income"
      ]
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /categories/:id` — deleteCategory

Deletes categorie. Fails with 409 if still referenced.

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

### `GET /transactions` — listTransactions

Transactions of a space, newest first, with filters (date range, account, category, envelope, kind, method, tag, text). Returns totals for the filtered set.

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
    "from": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "to": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "accountId": {
      "type": "string"
    },
    "categoryId": {
      "type": "string"
    },
    "envelopeId": {
      "type": "string"
    },
    "kind": {
      "type": "string",
      "enum": [
        "expense",
        "income",
        "transfer"
      ]
    },
    "method": {
      "type": "string",
      "enum": [
        "upi",
        "card",
        "cash",
        "netbanking",
        "cheque",
        "auto_debit",
        "other"
      ]
    },
    "tag": {
      "type": "string"
    },
    "q": {
      "type": "string"
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
    "spaceId"
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
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      }
    },
    "total": {
      "type": "number"
    },
    "income": {
      "type": "number"
    },
    "expense": {
      "type": "number"
    }
  },
  "required": [
    "items",
    "total",
    "income",
    "expense"
  ],
  "additionalProperties": false
}
```

### `POST /transactions` — createTransaction

Records an expense, income or transfer. Transfers move money between two accounts (a credit-card payment is a transfer from a bank account to the card).

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
    "accountId": {
      "type": "string"
    },
    "kind": {
      "type": "string",
      "enum": [
        "expense",
        "income",
        "transfer"
      ]
    },
    "amount": {
      "type": "number",
      "exclusiveMinimum": 0
    },
    "date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "categoryId": {
      "type": [
        "string",
        "null"
      ]
    },
    "toAccountId": {
      "type": [
        "string",
        "null"
      ]
    },
    "payee": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 120
        },
        {
          "type": "null"
        }
      ]
    },
    "note": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 1000
        },
        {
          "type": "null"
        }
      ]
    },
    "method": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "upi",
            "card",
            "cash",
            "netbanking",
            "cheque",
            "auto_debit",
            "other"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "tags": {
      "maxItems": 20,
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 30
      }
    },
    "envelopeId": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "spaceId",
    "accountId",
    "kind",
    "amount",
    "date"
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

### `PATCH /transactions/:id` — updateTransaction

Edits a transaction (any field).

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
    "accountId": {
      "type": "string"
    },
    "kind": {
      "type": "string",
      "enum": [
        "expense",
        "income",
        "transfer"
      ]
    },
    "amount": {
      "type": "number",
      "exclusiveMinimum": 0
    },
    "date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "categoryId": {
      "type": [
        "string",
        "null"
      ]
    },
    "toAccountId": {
      "type": [
        "string",
        "null"
      ]
    },
    "payee": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 120
        },
        {
          "type": "null"
        }
      ]
    },
    "note": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 1000
        },
        {
          "type": "null"
        }
      ]
    },
    "method": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "upi",
            "card",
            "cash",
            "netbanking",
            "cheque",
            "auto_debit",
            "other"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "tags": {
      "maxItems": 20,
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 30
      }
    },
    "envelopeId": {
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /transactions/:id` — deleteTransaction

Deletes a transaction.

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

### `GET /payees` — listPayees

Distinct payees and tags used in a space (for autocomplete).

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
  "type": "object",
  "properties": {
    "payees": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "tags": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "payees",
    "tags"
  ],
  "additionalProperties": false
}
```

### `GET /budgets` — listBudgets

Monthly budgets with spending for a month (default current). Also returns spending in categories that have no budget.

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
    "month": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}$"
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
  "type": "object",
  "properties": {
    "month": {
      "type": "string"
    },
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
    "unbudgeted": {
      "type": "array",
      "items": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      }
    },
    "totals": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    }
  },
  "required": [
    "month",
    "items",
    "unbudgeted",
    "totals"
  ],
  "additionalProperties": false
}
```

### `PUT /budgets` — setBudget

Creates or updates the monthly budget for an expense category.

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
    "categoryId": {
      "type": "string"
    },
    "amount": {
      "type": "number",
      "minimum": 0
    }
  },
  "required": [
    "spaceId",
    "categoryId",
    "amount"
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

### `DELETE /budgets/:id` — deleteBudget

Removes a category budget.

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

### `GET /envelopes` — listEnvelopes

Envelopes with funded / spent / balance. `unallocated` = spendable account money (bank, cash, UPI, wallet) not yet assigned to an envelope.

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
    "includeArchived": {
      "type": "boolean"
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
    "totalBalance": {
      "type": "number"
    },
    "unallocated": {
      "type": "number"
    }
  },
  "required": [
    "items",
    "totalBalance",
    "unallocated"
  ],
  "additionalProperties": false
}
```

### `POST /envelopes` — createEnvelope

Creates envelope in a space.

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
      "maxLength": 80
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "target": {
      "type": [
        "number",
        "null"
      ]
    },
    "monthlyFill": {
      "type": [
        "number",
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `PATCH /envelopes/:id` — updateEnvelope

Updates envelope.

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
      "type": "string",
      "minLength": 1,
      "maxLength": 80
    },
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "target": {
      "type": [
        "number",
        "null"
      ]
    },
    "monthlyFill": {
      "type": [
        "number",
        "null"
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /envelopes/:id` — deleteEnvelope

Deletes envelope. Fails with 409 if still referenced.

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

### `POST /envelopes/:id/allocate` — allocateEnvelope

Funds an envelope (positive amount) or releases money from it (negative).

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
    "amount": {
      "type": "number"
    },
    "date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "note": {
      "type": "string",
      "maxLength": 200
    }
  },
  "required": [
    "id",
    "amount"
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

### `POST /envelopes/transfer` — transferBetweenEnvelopes

Moves allocated money from one envelope to another.

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
    "fromId": {
      "type": "string"
    },
    "toId": {
      "type": "string"
    },
    "amount": {
      "type": "number",
      "exclusiveMinimum": 0
    },
    "note": {
      "type": "string",
      "maxLength": 200
    }
  },
  "required": [
    "spaceId",
    "fromId",
    "toId",
    "amount"
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

### `POST /envelopes/fill` — fillEnvelopes

Adds each envelope's monthly fill amount (the monthly top-up ritual).

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
  "type": "object",
  "properties": {
    "filled": {
      "type": "number"
    },
    "total": {
      "type": "number"
    }
  },
  "required": [
    "filled",
    "total"
  ],
  "additionalProperties": false
}
```

### `GET /envelopes/:id/history` — envelopeHistory

Allocations and tagged expenses of one envelope, newest first.

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
    "allocations": {
      "type": "array",
      "items": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {}
      }
    },
    "expenses": {
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
    "allocations",
    "expenses"
  ],
  "additionalProperties": false
}
```

### `DELETE /envelope-allocations/:id` — deleteEnvelopeAllocation

Removes one allocation entry.

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

### `GET /goals` — listGoals

Savings goals with saved amount, progress and the monthly saving needed to hit the target date.

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
    "includeArchived": {
      "type": "boolean"
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

### `POST /goals` — createGoal

Creates goal in a space.

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
      "maxLength": 80
    },
    "kind": {
      "type": "string",
      "enum": [
        "savings",
        "retirement",
        "emergency",
        "other"
      ]
    },
    "targetAmount": {
      "type": "number",
      "exclusiveMinimum": 0
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
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "note": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 2000
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "spaceId",
    "name",
    "targetAmount"
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

### `PATCH /goals/:id` — updateGoal

Updates goal.

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
      "type": "string",
      "minLength": 1,
      "maxLength": 80
    },
    "kind": {
      "type": "string",
      "enum": [
        "savings",
        "retirement",
        "emergency",
        "other"
      ]
    },
    "targetAmount": {
      "type": "number",
      "exclusiveMinimum": 0
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
    "color": {
      "type": "string",
      "pattern": "^#[0-9a-fA-F]{6}$"
    },
    "note": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 2000
        },
        {
          "type": "null"
        }
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /goals/:id` — deleteGoal

Deletes goal. Fails with 409 if still referenced.

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

### `POST /goals/:id/contributions` — addGoalContribution

Adds money to a goal (negative amount withdraws).

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
    "amount": {
      "type": "number"
    },
    "date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "note": {
      "type": "string",
      "maxLength": 200
    }
  },
  "required": [
    "id",
    "amount"
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

### `GET /goals/:id/contributions` — listGoalContributions

Contribution history of a goal.

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

### `DELETE /goal-contributions/:id` — deleteGoalContribution

Removes one contribution.

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

### `GET /holdings` — listHoldings

Investments with computed invested / value / gain. FDs and RDs are valued from their terms (principal, rate, compounding, dates) and show maturity value; stocks/funds/metals use quantity × current price; PPF/EPF/NPS/real-estate use the manual current value.

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
    "assetClass": {
      "type": "string"
    },
    "includeArchived": {
      "type": "boolean"
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
    "summary": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    }
  },
  "required": [
    "items",
    "summary"
  ],
  "additionalProperties": false
}
```

### `POST /holdings` — createHolding

Creates holding in a space.

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
    "assetClass": {
      "type": "string",
      "enum": [
        "stock",
        "mutual_fund",
        "etf",
        "gold",
        "silver",
        "platinum",
        "fd",
        "rd",
        "ppf",
        "epf",
        "nps",
        "bond",
        "crypto",
        "real_estate",
        "other"
      ]
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 120
    },
    "symbol": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 40
        },
        {
          "type": "null"
        }
      ]
    },
    "institution": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 80
        },
        {
          "type": "null"
        }
      ]
    },
    "quantity": {
      "type": "number"
    },
    "avgCost": {
      "type": "number"
    },
    "currentPrice": {
      "type": [
        "number",
        "null"
      ]
    },
    "principal": {
      "type": [
        "number",
        "null"
      ]
    },
    "currentValue": {
      "type": [
        "number",
        "null"
      ]
    },
    "interestRate": {
      "type": [
        "number",
        "null"
      ]
    },
    "compounding": {
      "type": "integer",
      "minimum": 1,
      "maximum": 365
    },
    "installment": {
      "type": [
        "number",
        "null"
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
    "maturityDate": {
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
    "unit": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 20
        },
        {
          "type": "null"
        }
      ]
    },
    "retirement": {
      "type": "boolean"
    },
    "note": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 2000
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "spaceId",
    "assetClass",
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

### `PATCH /holdings/:id` — updateHolding

Updates holding.

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
    "assetClass": {
      "type": "string",
      "enum": [
        "stock",
        "mutual_fund",
        "etf",
        "gold",
        "silver",
        "platinum",
        "fd",
        "rd",
        "ppf",
        "epf",
        "nps",
        "bond",
        "crypto",
        "real_estate",
        "other"
      ]
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 120
    },
    "symbol": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 40
        },
        {
          "type": "null"
        }
      ]
    },
    "institution": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 80
        },
        {
          "type": "null"
        }
      ]
    },
    "quantity": {
      "type": "number"
    },
    "avgCost": {
      "type": "number"
    },
    "currentPrice": {
      "type": [
        "number",
        "null"
      ]
    },
    "principal": {
      "type": [
        "number",
        "null"
      ]
    },
    "currentValue": {
      "type": [
        "number",
        "null"
      ]
    },
    "interestRate": {
      "type": [
        "number",
        "null"
      ]
    },
    "compounding": {
      "type": "integer",
      "minimum": 1,
      "maximum": 365
    },
    "installment": {
      "type": [
        "number",
        "null"
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
    "maturityDate": {
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
    "unit": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 20
        },
        {
          "type": "null"
        }
      ]
    },
    "retirement": {
      "type": "boolean"
    },
    "note": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 2000
        },
        {
          "type": "null"
        }
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /holdings/:id` — deleteHolding

Deletes holding. Fails with 409 if still referenced.

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

### `POST /holdings/prices` — updateHoldingPrices

Bulk-updates current prices / NAVs (e.g. after copying quotes). Items: [{id, price}].

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
    "prices": {
      "minItems": 1,
      "maxItems": 500,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "price": {
            "type": "number",
            "minimum": 0
          }
        },
        "required": [
          "id",
          "price"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "spaceId",
    "prices"
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
    "updated": {
      "type": "number"
    }
  },
  "required": [
    "updated"
  ],
  "additionalProperties": false
}
```

### `POST /holdings/:id/trade` — tradeHolding

Records a buy (weighted-average cost updates) or sell on a quantity-based holding (stock, fund, metal, crypto…). Also sets the current price to the trade price.

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
    "side": {
      "type": "string",
      "enum": [
        "buy",
        "sell"
      ]
    },
    "quantity": {
      "type": "number",
      "exclusiveMinimum": 0
    },
    "price": {
      "type": "number",
      "minimum": 0
    },
    "fees": {
      "type": "number",
      "minimum": 0
    },
    "date": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    }
  },
  "required": [
    "id",
    "side",
    "quantity",
    "price"
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

### `GET /holdings/:id/trades` — listHoldingTrades

Buy/sell history of a holding.

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

### `GET /liabilities` — listLiabilities

Lists liabilities (loans) of a space.

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
    "includeArchived": {
      "type": "boolean"
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

### `POST /liabilities` — createLiability

Creates liabilities (loans) in a space.

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
      "maxLength": 120
    },
    "kind": {
      "type": "string",
      "enum": [
        "home_loan",
        "car_loan",
        "personal_loan",
        "education_loan",
        "credit_card",
        "other"
      ]
    },
    "principal": {
      "type": "number"
    },
    "outstanding": {
      "type": "number"
    },
    "interestRate": {
      "type": [
        "number",
        "null"
      ]
    },
    "emi": {
      "type": [
        "number",
        "null"
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
    "endDate": {
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
    "note": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 2000
        },
        {
          "type": "null"
        }
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `PATCH /liabilities/:id` — updateLiability

Updates liabilities (loans).

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
      "type": "string",
      "minLength": 1,
      "maxLength": 120
    },
    "kind": {
      "type": "string",
      "enum": [
        "home_loan",
        "car_loan",
        "personal_loan",
        "education_loan",
        "credit_card",
        "other"
      ]
    },
    "principal": {
      "type": "number"
    },
    "outstanding": {
      "type": "number"
    },
    "interestRate": {
      "type": [
        "number",
        "null"
      ]
    },
    "emi": {
      "type": [
        "number",
        "null"
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
    "endDate": {
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
    "note": {
      "anyOf": [
        {
          "type": "string",
          "maxLength": 2000
        },
        {
          "type": "null"
        }
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
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `DELETE /liabilities/:id` — deleteLiability

Deletes liabilities (loans). Fails with 409 if still referenced.

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

### `GET /settings` — getSettings

Space settings: currency and net-worth target.

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
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `PUT /settings` — updateSettings

Updates the space's currency (ISO code) and/or net-worth target (null clears).

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
    "currency": {
      "type": "string",
      "minLength": 3,
      "maxLength": 3
    },
    "networthTarget": {
      "type": [
        "number",
        "null"
      ]
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
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `GET /networth` — getNetWorth

Net worth now (assets − liabilities, with breakdown), saved daily snapshots (history), 12-month net-cash trend rebuilt from transactions, and progress toward the target.

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
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `POST /networth/snapshot` — saveNetWorthSnapshot

Stores today's net-worth snapshot (idempotent; one per day).

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
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `GET /retirement` — getRetirement

Saved retirement plan (or defaults), retirement corpus built from flagged holdings (+PPF/EPF/NPS) and the projection: required corpus, projected corpus, shortfall, saving needed, year-by-year series.

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
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `PUT /retirement` — saveRetirement

Saves the retirement plan assumptions (partial update).

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
    "currentAge": {
      "type": "integer",
      "minimum": 14,
      "maximum": 100
    },
    "retirementAge": {
      "type": "integer",
      "minimum": 15,
      "maximum": 100
    },
    "lifeExpectancy": {
      "type": "integer",
      "minimum": 16,
      "maximum": 120
    },
    "monthlyExpense": {
      "type": "number",
      "minimum": 0
    },
    "inflation": {
      "type": "number",
      "minimum": 0,
      "maximum": 30
    },
    "preReturn": {
      "type": "number",
      "minimum": 0,
      "maximum": 40
    },
    "postReturn": {
      "type": "number",
      "minimum": 0,
      "maximum": 30
    },
    "monthlySaving": {
      "type": "number",
      "minimum": 0
    },
    "stepUp": {
      "type": "number",
      "minimum": 0,
      "maximum": 30
    },
    "otherCorpus": {
      "type": "number",
      "minimum": 0
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
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `POST /retirement/project` — projectRetirement

What-if projection with overridden assumptions; nothing is saved.

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
    "currentAge": {
      "type": "integer",
      "minimum": 14,
      "maximum": 100
    },
    "retirementAge": {
      "type": "integer",
      "minimum": 15,
      "maximum": 100
    },
    "lifeExpectancy": {
      "type": "integer",
      "minimum": 16,
      "maximum": 120
    },
    "monthlyExpense": {
      "type": "number",
      "minimum": 0
    },
    "inflation": {
      "type": "number",
      "minimum": 0,
      "maximum": 30
    },
    "preReturn": {
      "type": "number",
      "minimum": 0,
      "maximum": 40
    },
    "postReturn": {
      "type": "number",
      "minimum": 0,
      "maximum": 30
    },
    "monthlySaving": {
      "type": "number",
      "minimum": 0
    },
    "stepUp": {
      "type": "number",
      "minimum": 0,
      "maximum": 30
    },
    "otherCorpus": {
      "type": "number",
      "minimum": 0
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
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `GET /overview` — getOverview

Dashboard for a month (default current): income/expense/net, month-end spending projection, budget status, net worth, accounts, credit-card dues, top categories, recent transactions.

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
    "month": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}$"
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
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```

### `GET /analytics` — getAnalytics

Spending analytics over a range (default last 12 months): monthly income/expense/savings, category breakdown and trend, payment-method and account split, top payees, weekday pattern, recurring payees, and a 3-month forecast from the completed-month trend.

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
    "from": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
    },
    "to": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
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
  "type": "object",
  "propertyNames": {
    "type": "string"
  },
  "additionalProperties": {}
}
```
