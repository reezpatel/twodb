# ENDPOINTS.md — Toolkit

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Central host for external MCP servers and API connectors — connector instances expose invocable tools and background broadcasts (with optional durable queues).

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/toolkit/api`
- **Capabilities**: none
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-17T06:27:28.310Z_

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

### `GET /twodb/tools` — listTwodbTools

The full TwoDB tool catalog: one tool per endpoint of every installed app (except toolkit), derived live from the control plane. Used by the configuration page; 403 when called with an agent context.

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
      "key": {
        "type": "string"
      },
      "app": {
        "type": "string"
      },
      "appName": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "description": {
        "type": "string"
      },
      "method": {
        "type": "string"
      },
      "path": {
        "type": "string"
      },
      "params": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "in": {
              "type": "string",
              "enum": [
                "path",
                "query",
                "body"
              ]
            },
            "type": {
              "type": "string",
              "enum": [
                "string",
                "number",
                "boolean",
                "array",
                "object"
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
            "name",
            "in",
            "type",
            "description",
            "required"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "key",
      "app",
      "appName",
      "name",
      "description",
      "method",
      "path",
      "params"
    ],
    "additionalProperties": false
  }
}
```

### `GET /twodb/access` — listTwodbAccess

Scopes (spaces / agents) that have at least one TwoDB tool enabled, with counts. Default is none.

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
      "scopeType": {
        "type": "string",
        "enum": [
          "space",
          "agent"
        ]
      },
      "scopeId": {
        "type": "string"
      },
      "count": {
        "type": "number"
      }
    },
    "required": [
      "scopeType",
      "scopeId",
      "count"
    ],
    "additionalProperties": false
  }
}
```

### `GET /twodb/access/:scopeType/:scopeId` — getTwodbAccess

The `<app>/<tool>` keys enabled for one scope (scopeType = space | agent).

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "scopeType": {
      "type": "string",
      "enum": [
        "space",
        "agent"
      ]
    },
    "scopeId": {
      "type": "string"
    }
  },
  "required": [
    "scopeType",
    "scopeId"
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
    "scopeType": {
      "type": "string"
    },
    "scopeId": {
      "type": "string"
    },
    "tools": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "scopeType",
    "scopeId",
    "tools"
  ],
  "additionalProperties": false
}
```

### `PUT /twodb/access/:scopeType/:scopeId` — setTwodbAccess

Replaces the enabled TwoDB tools of one scope. Keys must exist in the catalog (400 otherwise); an empty list clears the scope. A tool is callable when enabled for the calling agent OR for the space of the call.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "scopeType": {
      "type": "string",
      "enum": [
        "space",
        "agent"
      ]
    },
    "scopeId": {
      "type": "string"
    },
    "tools": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "scopeType",
    "scopeId",
    "tools"
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
    "scopeType": {
      "type": "string"
    },
    "scopeId": {
      "type": "string"
    },
    "tools": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "scopeType",
    "scopeId",
    "tools"
  ],
  "additionalProperties": false
}
```

### `GET /twodb/apps` — listTwodbApps

Agent-facing (needs ?agentId= + the call's space via x-twodb-space-ids or ?spaceId=): the apps that have at least one TwoDB tool enabled for this agent or space, with tool counts.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "agentId": {
      "type": "string"
    },
    "spaceId": {
      "type": "string"
    }
  },
  "required": [
    "agentId"
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
      "slug": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "tools": {
        "type": "number"
      }
    },
    "required": [
      "slug",
      "name",
      "tools"
    ],
    "additionalProperties": false
  }
}
```

### `GET /twodb/apps/:app/tools` — listTwodbAppTools

Agent-facing: one app's enabled tools (name, HTTP method, description) — no parameter schemas, to keep context small.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "app": {
      "type": "string"
    },
    "agentId": {
      "type": "string"
    },
    "spaceId": {
      "type": "string"
    }
  },
  "required": [
    "app",
    "agentId"
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
      "name": {
        "type": "string"
      },
      "method": {
        "type": "string"
      },
      "description": {
        "type": "string"
      }
    },
    "required": [
      "name",
      "method",
      "description"
    ],
    "additionalProperties": false
  }
}
```

### `GET /twodb/apps/:app/tools/:tool` — getTwodbAppTool

Agent-facing: one enabled tool with its full parameter list (location, type, required, options). 404 when not enabled.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "app": {
      "type": "string"
    },
    "tool": {
      "type": "string"
    },
    "agentId": {
      "type": "string"
    },
    "spaceId": {
      "type": "string"
    }
  },
  "required": [
    "app",
    "tool",
    "agentId"
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
    "key": {
      "type": "string"
    },
    "app": {
      "type": "string"
    },
    "appName": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "method": {
      "type": "string"
    },
    "path": {
      "type": "string"
    },
    "params": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "in": {
            "type": "string",
            "enum": [
              "path",
              "query",
              "body"
            ]
          },
          "type": {
            "type": "string",
            "enum": [
              "string",
              "number",
              "boolean",
              "array",
              "object"
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
          "name",
          "in",
          "type",
          "description",
          "required"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "key",
    "app",
    "appName",
    "name",
    "description",
    "method",
    "path",
    "params"
  ],
  "additionalProperties": false
}
```

### `POST /twodb/apps/:app/tools/:tool/invoke` — invokeTwodbAppTool

Agent-facing: runs an enabled tool and returns `{ output }`. Toolkit acts machine-to-machine through the gateway in the workspace, attaching the call's space (x-twodb-space-ids). Params are validated against the tool (400); a tool not enabled for the agent or space answers 403; the app's own error status is passed through.

- **Auth**: `session-or-apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "app": {
      "type": "string"
    },
    "tool": {
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
    },
    "spaceId": {
      "type": "string"
    }
  },
  "required": [
    "app",
    "tool",
    "agentId"
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
