# ENDPOINTS.md — Toolkit

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Central host for external MCP servers and API connectors — connector instances expose invocable tools and background broadcasts (with optional durable queues).

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/toolkit/api`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-15T19:04:18.834Z_

## Endpoints

### `GET /mcp` — listMcpServers

Lists the workspace's registered external MCP servers.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {},
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
      "url": {
        "type": "string"
      },
      "transport": {
        "type": "string",
        "enum": [
          "auto",
          "http",
          "sse"
        ]
      },
      "headers": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {
          "type": "string"
        }
      },
      "enabled": {
        "type": "boolean"
      },
      "scope": {
        "type": "object",
        "properties": {
          "all": {
            "type": "boolean"
          },
          "ids": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "all",
          "ids"
        ],
        "additionalProperties": false
      },
      "agentIds": {
        "type": "array",
        "items": {
          "type": "string"
        }
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
      "url",
      "transport",
      "headers",
      "enabled",
      "scope",
      "agentIds",
      "createdAt",
      "updatedAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /mcp` — createMcpServer

Registers an external MCP server (http/sse). Name must be unique in the workspace.

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
    "url": {
      "type": "string"
    },
    "transport": {
      "type": "string",
      "enum": [
        "auto",
        "http",
        "sse"
      ]
    },
    "headers": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "name",
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
    "name": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "transport": {
      "type": "string",
      "enum": [
        "auto",
        "http",
        "sse"
      ]
    },
    "headers": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
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
    "url",
    "transport",
    "headers",
    "enabled",
    "scope",
    "agentIds",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `PATCH /mcp/:id` — updateMcpServer

Updates name/url/transport/headers/enabled/scope. Only provided fields change.

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
    "url": {
      "type": "string"
    },
    "transport": {
      "type": "string",
      "enum": [
        "auto",
        "http",
        "sse"
      ]
    },
    "headers": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
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
    "name": {
      "type": "string"
    },
    "url": {
      "type": "string"
    },
    "transport": {
      "type": "string",
      "enum": [
        "auto",
        "http",
        "sse"
      ]
    },
    "headers": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
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
    "url",
    "transport",
    "headers",
    "enabled",
    "scope",
    "agentIds",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /mcp/:id` — deleteMcpServer

Removes an MCP server.

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

### `POST /mcp/import` — importMcpServers

Bulk-imports the standard `{ "mcpServers": { … } }` JSON (VS Code / Claude Desktop / Cursor). stdio entries are skipped.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "json": {},
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "json"
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
          "url": {
            "type": "string"
          },
          "transport": {
            "type": "string",
            "enum": [
              "auto",
              "http",
              "sse"
            ]
          },
          "headers": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "string"
            }
          },
          "enabled": {
            "type": "boolean"
          },
          "scope": {
            "type": "object",
            "properties": {
              "all": {
                "type": "boolean"
              },
              "ids": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "all",
              "ids"
            ],
            "additionalProperties": false
          },
          "agentIds": {
            "type": "array",
            "items": {
              "type": "string"
            }
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
          "url",
          "transport",
          "headers",
          "enabled",
          "scope",
          "agentIds",
          "createdAt",
          "updatedAt"
        ],
        "additionalProperties": false
      }
    },
    "skipped": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          }
        },
        "required": [
          "name",
          "reason"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "created",
    "skipped"
  ],
  "additionalProperties": false
}
```

### `GET /connector-templates` — listConnectorTemplates

The connector template gallery (fields to render config forms, commands, broadcasts).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {},
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
      "description": {
        "type": "string"
      },
      "icon": {
        "type": "string"
      },
      "fields": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "key": {
              "type": "string"
            },
            "label": {
              "type": "string"
            },
            "secret": {
              "type": "boolean"
            },
            "required": {
              "type": "boolean"
            },
            "optional": {
              "type": "boolean"
            },
            "placeholder": {
              "type": "string"
            },
            "help": {
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
      "commands": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "params": {
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "enum": [
                      "string",
                      "number",
                      "boolean",
                      "enum",
                      "date"
                    ]
                  },
                  "description": {
                    "type": "string"
                  },
                  "required": {
                    "type": "boolean"
                  },
                  "options": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  }
                },
                "required": [
                  "type",
                  "description"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "name",
            "description",
            "params"
          ],
          "additionalProperties": false
        }
      },
      "broadcasts": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "event": {
              "type": "string"
            },
            "description": {
              "type": "string"
            }
          },
          "required": [
            "event",
            "description"
          ],
          "additionalProperties": false
        }
      },
      "pollIntervalMs": {
        "type": "number"
      }
    },
    "required": [
      "id",
      "name",
      "description",
      "icon",
      "fields",
      "commands",
      "broadcasts"
    ],
    "additionalProperties": false
  }
}
```

### `GET /instances` — listConnectorInstances

Connector instances of the workspace (all templates).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "templateId": {
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
      "templateId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "enabled": {
        "type": "boolean"
      },
      "scope": {
        "type": "object",
        "properties": {
          "all": {
            "type": "boolean"
          },
          "ids": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "all",
          "ids"
        ],
        "additionalProperties": false
      },
      "agentIds": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "healthStatus": {
        "anyOf": [
          {
            "type": "string",
            "enum": [
              "ok",
              "error"
            ]
          },
          {
            "type": "null"
          }
        ]
      },
      "healthError": {
        "type": [
          "string",
          "null"
        ]
      },
      "healthCheckedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "config": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {
          "type": "string"
        }
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
      "templateId",
      "name",
      "enabled",
      "scope",
      "agentIds",
      "healthStatus",
      "healthError",
      "healthCheckedAt",
      "config",
      "createdAt",
      "updatedAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /instances` — createConnectorInstance

Configures a new instance of a connector template. Config values for secret fields are encrypted at rest. Runs healthCheck before saving; a failing check is a 502 unless force=true.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "templateId": {
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
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "force": {
      "type": "boolean"
    }
  },
  "required": [
    "templateId",
    "name",
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
    "templateId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "healthStatus": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "ok",
            "error"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "healthError": {
      "type": [
        "string",
        "null"
      ]
    },
    "healthCheckedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "config": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
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
    "templateId",
    "name",
    "enabled",
    "scope",
    "agentIds",
    "healthStatus",
    "healthError",
    "healthCheckedAt",
    "config",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `GET /instances/:id` — getConnectorInstance

One instance with its tools (commands) — the instance page's payload.

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
    "templateId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "healthStatus": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "ok",
            "error"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "healthError": {
      "type": [
        "string",
        "null"
      ]
    },
    "healthCheckedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "config": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
    },
    "createdAt": {
      "type": "string"
    },
    "updatedAt": {
      "type": "string"
    },
    "template": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "icon": {
          "type": "string"
        },
        "fields": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "key": {
                "type": "string"
              },
              "label": {
                "type": "string"
              },
              "secret": {
                "type": "boolean"
              },
              "required": {
                "type": "boolean"
              },
              "optional": {
                "type": "boolean"
              },
              "placeholder": {
                "type": "string"
              },
              "help": {
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
        "commands": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string"
              },
              "description": {
                "type": "string"
              },
              "params": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "enum": [
                        "string",
                        "number",
                        "boolean",
                        "enum",
                        "date"
                      ]
                    },
                    "description": {
                      "type": "string"
                    },
                    "required": {
                      "type": "boolean"
                    },
                    "options": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "required": [
                    "type",
                    "description"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "name",
              "description",
              "params"
            ],
            "additionalProperties": false
          }
        },
        "broadcasts": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "event": {
                "type": "string"
              },
              "description": {
                "type": "string"
              }
            },
            "required": [
              "event",
              "description"
            ],
            "additionalProperties": false
          }
        },
        "pollIntervalMs": {
          "type": "number"
        }
      },
      "required": [
        "id",
        "name",
        "description",
        "icon",
        "fields",
        "commands",
        "broadcasts"
      ],
      "additionalProperties": false
    },
    "tools": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "instanceId": {
            "type": "string"
          },
          "instanceName": {
            "type": "string"
          },
          "templateId": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "params": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "string",
                    "number",
                    "boolean",
                    "enum",
                    "date"
                  ]
                },
                "description": {
                  "type": "string"
                },
                "required": {
                  "type": "boolean"
                },
                "options": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              },
              "required": [
                "type",
                "description"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "id",
          "instanceId",
          "instanceName",
          "templateId",
          "name",
          "description",
          "params"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "id",
    "templateId",
    "name",
    "enabled",
    "scope",
    "agentIds",
    "healthStatus",
    "healthError",
    "healthCheckedAt",
    "config",
    "createdAt",
    "updatedAt",
    "template",
    "tools"
  ],
  "additionalProperties": false
}
```

### `PATCH /instances/:id` — updateConnectorInstance

Updates name/config/enabled/scope. Secret fields left masked in the request keep their stored value. Re-runs healthCheck on config changes.

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
      "additionalProperties": {
        "type": "string"
      }
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "force": {
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
    "templateId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "healthStatus": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "ok",
            "error"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "healthError": {
      "type": [
        "string",
        "null"
      ]
    },
    "healthCheckedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "config": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
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
    "templateId",
    "name",
    "enabled",
    "scope",
    "agentIds",
    "healthStatus",
    "healthError",
    "healthCheckedAt",
    "config",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `DELETE /instances/:id` — deleteConnectorInstance

Deletes an instance with its queues and state.

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

### `POST /instances/:id/health` — checkInstanceHealth

Runs the template's healthCheck against the stored config and records the outcome.

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
    "templateId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "enabled": {
      "type": "boolean"
    },
    "scope": {
      "type": "object",
      "properties": {
        "all": {
          "type": "boolean"
        },
        "ids": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": [
        "all",
        "ids"
      ],
      "additionalProperties": false
    },
    "agentIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "healthStatus": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "ok",
            "error"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "healthError": {
      "type": [
        "string",
        "null"
      ]
    },
    "healthCheckedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "config": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string"
      }
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
    "templateId",
    "name",
    "enabled",
    "scope",
    "agentIds",
    "healthStatus",
    "healthError",
    "healthCheckedAt",
    "config",
    "createdAt",
    "updatedAt"
  ],
  "additionalProperties": false
}
```

### `POST /instances/:id/poll` — runInstancePoll

Runs one background poll immediately (emits broadcasts for any detected changes).

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

### `GET /tools` — listTools

Every available tool across enabled instances (optionally ?templateId= filters). Tool names are `<instance>_<command>` (slugified instance name — stable, id-free). Trusted app callers (e.g. Artisan) pass ?agentId= (+ x-twodb-space-ids via the gateway) to get only tools that agent may use; without it, the full workspace list returns.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "templateId": {
      "type": "string"
    },
    "agentId": {
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
      "instanceId": {
        "type": "string"
      },
      "instanceName": {
        "type": "string"
      },
      "templateId": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "params": {
        "type": "object",
        "propertyNames": {
          "type": "string"
        },
        "additionalProperties": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "string",
                "number",
                "boolean",
                "enum",
                "date"
              ]
            },
            "description": {
              "type": "string"
            },
            "required": {
              "type": "boolean"
            },
            "options": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "type",
            "description"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "id",
      "instanceId",
      "instanceName",
      "templateId",
      "name",
      "description",
      "params"
    ],
    "additionalProperties": false
  }
}
```

### `POST /tools/:toolId/invoke` — invokeTool

Invokes a connector tool and returns `{ output }`. toolId is either the id form `<instanceId>.<command>` (webapp) or the agent-facing NAME `<instance>_<command>` — name-form calls should carry ?agentId= (Artisan sends it) so access lists are enforced. Required/number params validated by toolkit.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "toolId": {
      "type": "string"
    },
    "params": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    },
    "agentId": {
      "type": "string"
    }
  },
  "required": [
    "toolId"
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
    "output": {}
  },
  "required": [
    "output"
  ],
  "additionalProperties": false
}
```

### `GET /agents` — listAgents

Proxies Artisan's agent list (id, name, type, description) for the workspace — the catalog the access picker builds from. 502 when Artisan is unreachable.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "agents": {
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
            "type": "string"
          },
          "description": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "name",
          "type",
          "description"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "agents"
  ],
  "additionalProperties": false
}
```

### `GET /events` — listBroadcasts

Recent broadcast events (newest first). ?instanceId=, ?event=, ?since= (ISO ts), ?limit=.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "instanceId": {
      "type": "string"
    },
    "event": {
      "type": "string"
    },
    "since": {
      "type": "string"
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
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "instanceId": {
            "type": "string"
          },
          "event": {
            "type": "string"
          },
          "payload": {},
          "createdAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "instanceId",
          "event",
          "payload",
          "createdAt"
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

### `GET /events/stream` — streamBroadcasts

Server-sent events of broadcasts as they are emitted (one SSE `data:` line per event). Same filters as /events for the initial snapshot behavior — stream emits only new events.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "instanceId": {
      "type": "string"
    },
    "event": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

### `GET /queues` — listQueues

Queues of the workspace (optionally ?instanceId=) with pending counts.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "instanceId": {
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
    "queues": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "instanceId": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "createdBy": {
            "type": [
              "string",
              "null"
            ]
          },
          "createdAt": {
            "type": "string"
          },
          "pending": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "instanceId",
          "name",
          "createdBy",
          "createdAt",
          "pending"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "queues"
  ],
  "additionalProperties": false
}
```

### `POST /queues` — createQueue

Requests a named durable queue for an instance's broadcasts — every emitted event is also inserted, so nothing is lost when a live broadcast is dropped. Idempotent per (instance, name).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "instanceId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    }
  },
  "required": [
    "instanceId",
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
    "instanceId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "createdBy": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdAt": {
      "type": "string"
    },
    "pending": {
      "type": "number"
    }
  },
  "required": [
    "id",
    "instanceId",
    "name",
    "createdBy",
    "createdAt",
    "pending"
  ],
  "additionalProperties": false
}
```

### `DELETE /queues/:instanceId/:name` — deleteQueue

Deletes a queue and its undelivered items.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "instanceId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    }
  },
  "required": [
    "instanceId",
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

### `POST /queues/:instanceId/:name/next` — nextQueueItem

Claims the oldest pending item (marks it delivered). 204-style empty result when the queue is drained — { item: null }.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "instanceId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    }
  },
  "required": [
    "instanceId",
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
    "item": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "queueId": {
              "type": "string"
            },
            "event": {
              "type": "string"
            },
            "payload": {},
            "status": {
              "type": "string"
            },
            "createdAt": {
              "type": "string"
            },
            "deliveredAt": {
              "type": [
                "string",
                "null"
              ]
            }
          },
          "required": [
            "id",
            "queueId",
            "event",
            "payload",
            "status",
            "createdAt",
            "deliveredAt"
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
    "item"
  ],
  "additionalProperties": false
}
```

### `GET /queues/:instanceId/:name/peek` — peekQueue

Looks at up to ?limit= items (default 20) without claiming them.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "instanceId": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "limit": {
      "type": "string"
    }
  },
  "required": [
    "instanceId",
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
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "queueId": {
            "type": "string"
          },
          "event": {
            "type": "string"
          },
          "payload": {},
          "status": {
            "type": "string"
          },
          "createdAt": {
            "type": "string"
          },
          "deliveredAt": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "queueId",
          "event",
          "payload",
          "status",
          "createdAt",
          "deliveredAt"
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
