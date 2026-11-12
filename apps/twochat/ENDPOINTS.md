# ENDPOINTS.md — TwoChat

> **Generated file — do not hand-edit.** Source of truth is `src/manifest.ts` (Zod schemas). Regenerate with `pnpm gen:docs`.

Workspace chat (Slack-style): public channels, DMs, threads, reactions, pins, saved items, drafts, read state, attachments, notifications, and composed block messages (buttons, images, fields, task lists…) authored by humans AND agent bots — bots participate as first-class members via workspace API keys.

- **Shape**: backend+webapp
- **Base path (via Gateway)**: `/apps/twochat`
- **Capabilities**: search, ws
- **Core deps**: core-data, core-platform, core-async

_Generated: 2026-11-12T13:23:28.516Z_

## Endpoints

### `GET /channels` — listChannels

Every visible channel + DM for the caller, each with unread count, member list and last-activity. The sidebar's single bootstrap call.

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
      "kind": {
        "type": "string",
        "enum": [
          "channel",
          "dm"
        ]
      },
      "name": {
        "type": "string"
      },
      "topic": {
        "type": [
          "string",
          "null"
        ]
      },
      "dmKey": {
        "type": [
          "string",
          "null"
        ]
      },
      "position": {
        "type": "number"
      },
      "createdBy": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdByType": {
        "type": "string",
        "enum": [
          "user",
          "bot"
        ]
      },
      "lastMessageAt": {
        "type": [
          "string",
          "null"
        ]
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
      "unreadCount": {
        "type": "number"
      },
      "memberCount": {
        "type": "number"
      },
      "members": {
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
                "user",
                "bot"
              ]
            },
            "userId": {
              "type": [
                "string",
                "null"
              ]
            },
            "botId": {
              "type": [
                "string",
                "null"
              ]
            },
            "name": {
              "type": "string"
            },
            "avatarEmoji": {
              "type": [
                "string",
                "null"
              ]
            },
            "role": {
              "type": "string",
              "enum": [
                "member",
                "admin"
              ]
            }
          },
          "required": [
            "id",
            "type",
            "userId",
            "botId",
            "name",
            "avatarEmoji",
            "role"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "id",
      "kind",
      "name",
      "topic",
      "dmKey",
      "position",
      "createdBy",
      "createdByType",
      "lastMessageAt",
      "archivedAt",
      "createdAt",
      "updatedAt",
      "unreadCount",
      "memberCount",
      "members"
    ],
    "additionalProperties": false
  }
}
```

### `POST /channels` — createChannel

Creates a group channel. `botIds` optionally adds agent participants at create time. Names are unique per workspace among kind=channel.

- **Auth**: `session`

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
    "topic": {
      "type": "string"
    },
    "botIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
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
    "kind": {
      "type": "string",
      "enum": [
        "channel",
        "dm"
      ]
    },
    "name": {
      "type": "string"
    },
    "topic": {
      "type": [
        "string",
        "null"
      ]
    },
    "dmKey": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "createdBy": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdByType": {
      "type": "string",
      "enum": [
        "user",
        "bot"
      ]
    },
    "lastMessageAt": {
      "type": [
        "string",
        "null"
      ]
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
    "unreadCount": {
      "type": "number"
    },
    "memberCount": {
      "type": "number"
    },
    "members": {
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
              "user",
              "bot"
            ]
          },
          "userId": {
            "type": [
              "string",
              "null"
            ]
          },
          "botId": {
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "avatarEmoji": {
            "type": [
              "string",
              "null"
            ]
          },
          "role": {
            "type": "string",
            "enum": [
              "member",
              "admin"
            ]
          }
        },
        "required": [
          "id",
          "type",
          "userId",
          "botId",
          "name",
          "avatarEmoji",
          "role"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "id",
    "kind",
    "name",
    "topic",
    "dmKey",
    "position",
    "createdBy",
    "createdByType",
    "lastMessageAt",
    "archivedAt",
    "createdAt",
    "updatedAt",
    "unreadCount",
    "memberCount",
    "members"
  ],
  "additionalProperties": false
}
```

### `GET /channels/:id` — getChannel

One channel with members. Members (incl. bots) can read; membership is checked. Agents use this with their workspace API key.

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
    "kind": {
      "type": "string",
      "enum": [
        "channel",
        "dm"
      ]
    },
    "name": {
      "type": "string"
    },
    "topic": {
      "type": [
        "string",
        "null"
      ]
    },
    "dmKey": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "createdBy": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdByType": {
      "type": "string",
      "enum": [
        "user",
        "bot"
      ]
    },
    "lastMessageAt": {
      "type": [
        "string",
        "null"
      ]
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
    "unreadCount": {
      "type": "number"
    },
    "memberCount": {
      "type": "number"
    },
    "members": {
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
              "user",
              "bot"
            ]
          },
          "userId": {
            "type": [
              "string",
              "null"
            ]
          },
          "botId": {
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "avatarEmoji": {
            "type": [
              "string",
              "null"
            ]
          },
          "role": {
            "type": "string",
            "enum": [
              "member",
              "admin"
            ]
          }
        },
        "required": [
          "id",
          "type",
          "userId",
          "botId",
          "name",
          "avatarEmoji",
          "role"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "id",
    "kind",
    "name",
    "topic",
    "dmKey",
    "position",
    "createdBy",
    "createdByType",
    "lastMessageAt",
    "archivedAt",
    "createdAt",
    "updatedAt",
    "unreadCount",
    "memberCount",
    "members"
  ],
  "additionalProperties": false
}
```

### `PATCH /channels/:id` — updateChannel

Rename / re-topic / (un)archive / reorder a channel.

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
    "topic": {
      "type": [
        "string",
        "null"
      ]
    },
    "archived": {
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
    "kind": {
      "type": "string",
      "enum": [
        "channel",
        "dm"
      ]
    },
    "name": {
      "type": "string"
    },
    "topic": {
      "type": [
        "string",
        "null"
      ]
    },
    "dmKey": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "createdBy": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdByType": {
      "type": "string",
      "enum": [
        "user",
        "bot"
      ]
    },
    "lastMessageAt": {
      "type": [
        "string",
        "null"
      ]
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
    "unreadCount": {
      "type": "number"
    },
    "memberCount": {
      "type": "number"
    },
    "members": {
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
              "user",
              "bot"
            ]
          },
          "userId": {
            "type": [
              "string",
              "null"
            ]
          },
          "botId": {
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "avatarEmoji": {
            "type": [
              "string",
              "null"
            ]
          },
          "role": {
            "type": "string",
            "enum": [
              "member",
              "admin"
            ]
          }
        },
        "required": [
          "id",
          "type",
          "userId",
          "botId",
          "name",
          "avatarEmoji",
          "role"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "id",
    "kind",
    "name",
    "topic",
    "dmKey",
    "position",
    "createdBy",
    "createdByType",
    "lastMessageAt",
    "archivedAt",
    "createdAt",
    "updatedAt",
    "unreadCount",
    "memberCount",
    "members"
  ],
  "additionalProperties": false
}
```

### `DELETE /channels/:id` — deleteChannel

Deletes a channel and (via FK cascade) its messages, members, pins and drafts.

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

### `POST /channels/:id/join` — joinChannel

Adds the caller (user or bot) to a channel. Bots use this to enter channels they participate in.

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

### `POST /channels/:id/leave` — leaveChannel

Removes the caller from a channel.

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

### `POST /dms` — openDm

Opens (or returns the existing) direct-message channel between the caller and the given users/bots. dm_key is the stable sorted actor set.

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "userIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "botIds": {
      "type": "array",
      "items": {
        "type": "string"
      }
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
    "id": {
      "type": "string"
    },
    "kind": {
      "type": "string",
      "enum": [
        "channel",
        "dm"
      ]
    },
    "name": {
      "type": "string"
    },
    "topic": {
      "type": [
        "string",
        "null"
      ]
    },
    "dmKey": {
      "type": [
        "string",
        "null"
      ]
    },
    "position": {
      "type": "number"
    },
    "createdBy": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdByType": {
      "type": "string",
      "enum": [
        "user",
        "bot"
      ]
    },
    "lastMessageAt": {
      "type": [
        "string",
        "null"
      ]
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
    "unreadCount": {
      "type": "number"
    },
    "memberCount": {
      "type": "number"
    },
    "members": {
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
              "user",
              "bot"
            ]
          },
          "userId": {
            "type": [
              "string",
              "null"
            ]
          },
          "botId": {
            "type": [
              "string",
              "null"
            ]
          },
          "name": {
            "type": "string"
          },
          "avatarEmoji": {
            "type": [
              "string",
              "null"
            ]
          },
          "role": {
            "type": "string",
            "enum": [
              "member",
              "admin"
            ]
          }
        },
        "required": [
          "id",
          "type",
          "userId",
          "botId",
          "name",
          "avatarEmoji",
          "role"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "id",
    "kind",
    "name",
    "topic",
    "dmKey",
    "position",
    "createdBy",
    "createdByType",
    "lastMessageAt",
    "archivedAt",
    "createdAt",
    "updatedAt",
    "unreadCount",
    "memberCount",
    "members"
  ],
  "additionalProperties": false
}
```

### `GET /channels/:id/messages` — listMessages

Channel history, newest-last, keyset-paginated with `before` = "<createdAtISO>~<messageId>". Agents poll this to catch up.

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
    "before": {
      "type": "string"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100
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
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "channelId": {
            "type": "string"
          },
          "authorType": {
            "type": "string",
            "enum": [
              "user",
              "bot"
            ]
          },
          "userId": {
            "type": [
              "string",
              "null"
            ]
          },
          "botId": {
            "type": [
              "string",
              "null"
            ]
          },
          "authorName": {
            "type": "string"
          },
          "authorEmoji": {
            "type": [
              "string",
              "null"
            ]
          },
          "text": {
            "type": "string"
          },
          "blocks": {
            "anyOf": [
              {
                "maxItems": 50,
                "type": "array",
                "items": {
                  "oneOf": [
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "markdown"
                        },
                        "text": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "type",
                        "text"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "divider"
                        }
                      },
                      "required": [
                        "type"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "image"
                        },
                        "url": {
                          "type": "string"
                        },
                        "alt": {
                          "type": "string"
                        },
                        "title": {
                          "type": "string"
                        },
                        "width": {
                          "type": "integer",
                          "exclusiveMinimum": 0,
                          "maximum": 1200
                        }
                      },
                      "required": [
                        "type",
                        "url"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "actions"
                        },
                        "elements": {
                          "minItems": 1,
                          "maxItems": 5,
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "type": {
                                "type": "string",
                                "const": "button"
                              },
                              "actionId": {
                                "type": "string",
                                "minLength": 1
                              },
                              "text": {
                                "type": "string"
                              },
                              "style": {
                                "type": "object",
                                "properties": {
                                  "tone": {
                                    "type": "string",
                                    "enum": [
                                      "default",
                                      "primary",
                                      "danger"
                                    ]
                                  },
                                  "disabled": {
                                    "type": "boolean"
                                  }
                                },
                                "additionalProperties": false
                              },
                              "value": {
                                "type": "string"
                              },
                              "confirm": {
                                "type": "object",
                                "properties": {
                                  "title": {
                                    "type": "string"
                                  },
                                  "text": {
                                    "type": "string"
                                  },
                                  "confirmText": {
                                    "default": "Confirm",
                                    "type": "string"
                                  },
                                  "denyText": {
                                    "default": "Cancel",
                                    "type": "string"
                                  },
                                  "tone": {
                                    "type": "string",
                                    "enum": [
                                      "default",
                                      "danger"
                                    ]
                                  }
                                },
                                "required": [
                                  "text",
                                  "confirmText",
                                  "denyText"
                                ],
                                "additionalProperties": false
                              }
                            },
                            "required": [
                              "type",
                              "actionId",
                              "text"
                            ],
                            "additionalProperties": false
                          }
                        }
                      },
                      "required": [
                        "type",
                        "elements"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "link-button"
                        },
                        "text": {
                          "type": "string"
                        },
                        "url": {
                          "type": "string"
                        },
                        "style": {
                          "type": "object",
                          "properties": {
                            "tone": {
                              "type": "string",
                              "enum": [
                                "default",
                                "primary",
                                "danger"
                              ]
                            },
                            "disabled": {
                              "type": "boolean"
                            }
                          },
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "type",
                        "text",
                        "url"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "field"
                        },
                        "label": {
                          "type": "string"
                        },
                        "value": {
                          "type": "string"
                        },
                        "short": {
                          "type": "boolean"
                        }
                      },
                      "required": [
                        "type",
                        "label",
                        "value"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "context"
                        },
                        "elements": {
                          "minItems": 1,
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "text": {
                                "type": "string"
                              },
                              "styles": {
                                "type": "object",
                                "properties": {
                                  "bold": {
                                    "type": "boolean"
                                  },
                                  "italic": {
                                    "type": "boolean"
                                  },
                                  "strike": {
                                    "type": "boolean"
                                  },
                                  "code": {
                                    "type": "boolean"
                                  }
                                },
                                "additionalProperties": false
                              },
                              "mention": {
                                "type": "object",
                                "properties": {
                                  "kind": {
                                    "type": "string",
                                    "enum": [
                                      "user",
                                      "bot",
                                      "channel"
                                    ]
                                  },
                                  "id": {
                                    "type": "string"
                                  },
                                  "label": {
                                    "type": "string"
                                  }
                                },
                                "required": [
                                  "kind",
                                  "id"
                                ],
                                "additionalProperties": false
                              }
                            },
                            "required": [
                              "text"
                            ],
                            "additionalProperties": false
                          }
                        }
                      },
                      "required": [
                        "type",
                        "elements"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "attachment"
                        },
                        "assetId": {
                          "type": "string"
                        },
                        "filename": {
                          "type": "string"
                        },
                        "contentType": {
                          "type": [
                            "string",
                            "null"
                          ]
                        },
                        "size": {
                          "type": "integer",
                          "minimum": 0,
                          "maximum": 9007199254740991
                        }
                      },
                      "required": [
                        "type",
                        "assetId",
                        "filename"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "link-card"
                        },
                        "url": {
                          "type": "string"
                        },
                        "title": {
                          "type": "string"
                        },
                        "description": {
                          "type": "string"
                        },
                        "imageUrl": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "type",
                        "url"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "quote"
                        },
                        "text": {
                          "type": "string"
                        },
                        "cite": {
                          "type": "string"
                        },
                        "url": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "type",
                        "text"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "status"
                        },
                        "state": {
                          "type": "string",
                          "enum": [
                            "info",
                            "success",
                            "warning",
                            "error",
                            "loading"
                          ]
                        },
                        "text": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "type",
                        "state",
                        "text"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "code"
                        },
                        "code": {
                          "type": "string"
                        },
                        "language": {
                          "type": "string"
                        },
                        "filename": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "type",
                        "code"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "task-list"
                        },
                        "title": {
                          "type": "string"
                        },
                        "tasks": {
                          "minItems": 1,
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "text": {
                                "type": "string"
                              },
                              "done": {
                                "type": "boolean"
                              }
                            },
                            "required": [
                              "text",
                              "done"
                            ],
                            "additionalProperties": false
                          }
                        }
                      },
                      "required": [
                        "type",
                        "tasks"
                      ],
                      "additionalProperties": false
                    },
                    {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "callout"
                        },
                        "tone": {
                          "default": "info",
                          "type": "string",
                          "enum": [
                            "info",
                            "success",
                            "warning",
                            "danger"
                          ]
                        },
                        "title": {
                          "type": "string"
                        },
                        "text": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "type",
                        "tone",
                        "text"
                      ],
                      "additionalProperties": false
                    }
                  ]
                }
              },
              {
                "type": "null"
              }
            ]
          },
          "replyToId": {
            "type": [
              "string",
              "null"
            ]
          },
          "replyTo": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "authorName": {
                    "type": "string"
                  },
                  "snippet": {
                    "type": "string"
                  }
                },
                "required": [
                  "id",
                  "authorName",
                  "snippet"
                ],
                "additionalProperties": false
              },
              {
                "type": "null"
              }
            ]
          },
          "editedAt": {
            "type": [
              "string",
              "null"
            ]
          },
          "deletedAt": {
            "type": [
              "string",
              "null"
            ]
          },
          "createdAt": {
            "type": "string"
          },
          "reactions": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "emoji": {
                  "type": "string"
                },
                "count": {
                  "type": "number"
                },
                "mine": {
                  "type": "boolean"
                }
              },
              "required": [
                "emoji",
                "count",
                "mine"
              ],
              "additionalProperties": false
            }
          },
          "pinned": {
            "type": "boolean"
          },
          "saved": {
            "type": "boolean"
          }
        },
        "required": [
          "id",
          "channelId",
          "authorType",
          "userId",
          "botId",
          "authorName",
          "authorEmoji",
          "text",
          "blocks",
          "replyToId",
          "replyTo",
          "editedAt",
          "deletedAt",
          "createdAt",
          "reactions",
          "pinned",
          "saved"
        ],
        "additionalProperties": false
      }
    },
    "next": {
      "type": [
        "string",
        "null"
      ]
    }
  },
  "required": [
    "messages",
    "next"
  ],
  "additionalProperties": false
}
```

### `POST /channels/:id/messages` — postMessage

Posts a message. Body is plain `text` and/or composed `blocks` (markdown, image, button rows, fields, code, task-lists… — src/blocks.ts). Mentions in context blocks and @name text notify those users. Single-level replies via `replyToId` (clamped to thread roots).

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
    "text": {
      "type": "string"
    },
    "blocks": {
      "maxItems": 50,
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "markdown"
              },
              "text": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "text"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "divider"
              }
            },
            "required": [
              "type"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "image"
              },
              "url": {
                "type": "string"
              },
              "alt": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "width": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 1200
              }
            },
            "required": [
              "type",
              "url"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "actions"
              },
              "elements": {
                "minItems": 1,
                "maxItems": 5,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "button"
                    },
                    "actionId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "text": {
                      "type": "string"
                    },
                    "style": {
                      "type": "object",
                      "properties": {
                        "tone": {
                          "type": "string",
                          "enum": [
                            "default",
                            "primary",
                            "danger"
                          ]
                        },
                        "disabled": {
                          "type": "boolean"
                        }
                      },
                      "additionalProperties": false
                    },
                    "value": {
                      "type": "string"
                    },
                    "confirm": {
                      "type": "object",
                      "properties": {
                        "title": {
                          "type": "string"
                        },
                        "text": {
                          "type": "string"
                        },
                        "confirmText": {
                          "default": "Confirm",
                          "type": "string"
                        },
                        "denyText": {
                          "default": "Cancel",
                          "type": "string"
                        },
                        "tone": {
                          "type": "string",
                          "enum": [
                            "default",
                            "danger"
                          ]
                        }
                      },
                      "required": [
                        "text",
                        "confirmText",
                        "denyText"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "type",
                    "actionId",
                    "text"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "type",
              "elements"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "link-button"
              },
              "text": {
                "type": "string"
              },
              "url": {
                "type": "string"
              },
              "style": {
                "type": "object",
                "properties": {
                  "tone": {
                    "type": "string",
                    "enum": [
                      "default",
                      "primary",
                      "danger"
                    ]
                  },
                  "disabled": {
                    "type": "boolean"
                  }
                },
                "additionalProperties": false
              }
            },
            "required": [
              "type",
              "text",
              "url"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "field"
              },
              "label": {
                "type": "string"
              },
              "value": {
                "type": "string"
              },
              "short": {
                "type": "boolean"
              }
            },
            "required": [
              "type",
              "label",
              "value"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "context"
              },
              "elements": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "text": {
                      "type": "string"
                    },
                    "styles": {
                      "type": "object",
                      "properties": {
                        "bold": {
                          "type": "boolean"
                        },
                        "italic": {
                          "type": "boolean"
                        },
                        "strike": {
                          "type": "boolean"
                        },
                        "code": {
                          "type": "boolean"
                        }
                      },
                      "additionalProperties": false
                    },
                    "mention": {
                      "type": "object",
                      "properties": {
                        "kind": {
                          "type": "string",
                          "enum": [
                            "user",
                            "bot",
                            "channel"
                          ]
                        },
                        "id": {
                          "type": "string"
                        },
                        "label": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "kind",
                        "id"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "text"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "type",
              "elements"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "attachment"
              },
              "assetId": {
                "type": "string"
              },
              "filename": {
                "type": "string"
              },
              "contentType": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "size": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "type",
              "assetId",
              "filename"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "link-card"
              },
              "url": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "description": {
                "type": "string"
              },
              "imageUrl": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "url"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "quote"
              },
              "text": {
                "type": "string"
              },
              "cite": {
                "type": "string"
              },
              "url": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "text"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "status"
              },
              "state": {
                "type": "string",
                "enum": [
                  "info",
                  "success",
                  "warning",
                  "error",
                  "loading"
                ]
              },
              "text": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "state",
              "text"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "code"
              },
              "code": {
                "type": "string"
              },
              "language": {
                "type": "string"
              },
              "filename": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "code"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "task-list"
              },
              "title": {
                "type": "string"
              },
              "tasks": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "text": {
                      "type": "string"
                    },
                    "done": {
                      "type": "boolean"
                    }
                  },
                  "required": [
                    "text",
                    "done"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "type",
              "tasks"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "callout"
              },
              "tone": {
                "default": "info",
                "type": "string",
                "enum": [
                  "info",
                  "success",
                  "warning",
                  "danger"
                ]
              },
              "title": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "tone",
              "text"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "replyToId": {
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
    "channelId": {
      "type": "string"
    },
    "authorType": {
      "type": "string",
      "enum": [
        "user",
        "bot"
      ]
    },
    "userId": {
      "type": [
        "string",
        "null"
      ]
    },
    "botId": {
      "type": [
        "string",
        "null"
      ]
    },
    "authorName": {
      "type": "string"
    },
    "authorEmoji": {
      "type": [
        "string",
        "null"
      ]
    },
    "text": {
      "type": "string"
    },
    "blocks": {
      "anyOf": [
        {
          "maxItems": 50,
          "type": "array",
          "items": {
            "oneOf": [
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "markdown"
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "text"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "divider"
                  }
                },
                "required": [
                  "type"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "image"
                  },
                  "url": {
                    "type": "string"
                  },
                  "alt": {
                    "type": "string"
                  },
                  "title": {
                    "type": "string"
                  },
                  "width": {
                    "type": "integer",
                    "exclusiveMinimum": 0,
                    "maximum": 1200
                  }
                },
                "required": [
                  "type",
                  "url"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "actions"
                  },
                  "elements": {
                    "minItems": 1,
                    "maxItems": 5,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "button"
                        },
                        "actionId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "text": {
                          "type": "string"
                        },
                        "style": {
                          "type": "object",
                          "properties": {
                            "tone": {
                              "type": "string",
                              "enum": [
                                "default",
                                "primary",
                                "danger"
                              ]
                            },
                            "disabled": {
                              "type": "boolean"
                            }
                          },
                          "additionalProperties": false
                        },
                        "value": {
                          "type": "string"
                        },
                        "confirm": {
                          "type": "object",
                          "properties": {
                            "title": {
                              "type": "string"
                            },
                            "text": {
                              "type": "string"
                            },
                            "confirmText": {
                              "default": "Confirm",
                              "type": "string"
                            },
                            "denyText": {
                              "default": "Cancel",
                              "type": "string"
                            },
                            "tone": {
                              "type": "string",
                              "enum": [
                                "default",
                                "danger"
                              ]
                            }
                          },
                          "required": [
                            "text",
                            "confirmText",
                            "denyText"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "type",
                        "actionId",
                        "text"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "type",
                  "elements"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "link-button"
                  },
                  "text": {
                    "type": "string"
                  },
                  "url": {
                    "type": "string"
                  },
                  "style": {
                    "type": "object",
                    "properties": {
                      "tone": {
                        "type": "string",
                        "enum": [
                          "default",
                          "primary",
                          "danger"
                        ]
                      },
                      "disabled": {
                        "type": "boolean"
                      }
                    },
                    "additionalProperties": false
                  }
                },
                "required": [
                  "type",
                  "text",
                  "url"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "field"
                  },
                  "label": {
                    "type": "string"
                  },
                  "value": {
                    "type": "string"
                  },
                  "short": {
                    "type": "boolean"
                  }
                },
                "required": [
                  "type",
                  "label",
                  "value"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "context"
                  },
                  "elements": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "text": {
                          "type": "string"
                        },
                        "styles": {
                          "type": "object",
                          "properties": {
                            "bold": {
                              "type": "boolean"
                            },
                            "italic": {
                              "type": "boolean"
                            },
                            "strike": {
                              "type": "boolean"
                            },
                            "code": {
                              "type": "boolean"
                            }
                          },
                          "additionalProperties": false
                        },
                        "mention": {
                          "type": "object",
                          "properties": {
                            "kind": {
                              "type": "string",
                              "enum": [
                                "user",
                                "bot",
                                "channel"
                              ]
                            },
                            "id": {
                              "type": "string"
                            },
                            "label": {
                              "type": "string"
                            }
                          },
                          "required": [
                            "kind",
                            "id"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "text"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "type",
                  "elements"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "attachment"
                  },
                  "assetId": {
                    "type": "string"
                  },
                  "filename": {
                    "type": "string"
                  },
                  "contentType": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "size": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991
                  }
                },
                "required": [
                  "type",
                  "assetId",
                  "filename"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "link-card"
                  },
                  "url": {
                    "type": "string"
                  },
                  "title": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  },
                  "imageUrl": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "url"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "quote"
                  },
                  "text": {
                    "type": "string"
                  },
                  "cite": {
                    "type": "string"
                  },
                  "url": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "text"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "status"
                  },
                  "state": {
                    "type": "string",
                    "enum": [
                      "info",
                      "success",
                      "warning",
                      "error",
                      "loading"
                    ]
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "state",
                  "text"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "code"
                  },
                  "code": {
                    "type": "string"
                  },
                  "language": {
                    "type": "string"
                  },
                  "filename": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "code"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "task-list"
                  },
                  "title": {
                    "type": "string"
                  },
                  "tasks": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "text": {
                          "type": "string"
                        },
                        "done": {
                          "type": "boolean"
                        }
                      },
                      "required": [
                        "text",
                        "done"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "type",
                  "tasks"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "callout"
                  },
                  "tone": {
                    "default": "info",
                    "type": "string",
                    "enum": [
                      "info",
                      "success",
                      "warning",
                      "danger"
                    ]
                  },
                  "title": {
                    "type": "string"
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "tone",
                  "text"
                ],
                "additionalProperties": false
              }
            ]
          }
        },
        {
          "type": "null"
        }
      ]
    },
    "replyToId": {
      "type": [
        "string",
        "null"
      ]
    },
    "replyTo": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "authorName": {
              "type": "string"
            },
            "snippet": {
              "type": "string"
            }
          },
          "required": [
            "id",
            "authorName",
            "snippet"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "editedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "deletedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdAt": {
      "type": "string"
    },
    "reactions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "emoji": {
            "type": "string"
          },
          "count": {
            "type": "number"
          },
          "mine": {
            "type": "boolean"
          }
        },
        "required": [
          "emoji",
          "count",
          "mine"
        ],
        "additionalProperties": false
      }
    },
    "pinned": {
      "type": "boolean"
    },
    "saved": {
      "type": "boolean"
    }
  },
  "required": [
    "id",
    "channelId",
    "authorType",
    "userId",
    "botId",
    "authorName",
    "authorEmoji",
    "text",
    "blocks",
    "replyToId",
    "replyTo",
    "editedAt",
    "deletedAt",
    "createdAt",
    "reactions",
    "pinned",
    "saved"
  ],
  "additionalProperties": false
}
```

### `PATCH /messages/:id` — editMessage

Edits your own message (text and/or blocks). Sets editedAt.

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
    "text": {
      "type": "string"
    },
    "blocks": {
      "maxItems": 50,
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "markdown"
              },
              "text": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "text"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "divider"
              }
            },
            "required": [
              "type"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "image"
              },
              "url": {
                "type": "string"
              },
              "alt": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "width": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 1200
              }
            },
            "required": [
              "type",
              "url"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "actions"
              },
              "elements": {
                "minItems": 1,
                "maxItems": 5,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "button"
                    },
                    "actionId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "text": {
                      "type": "string"
                    },
                    "style": {
                      "type": "object",
                      "properties": {
                        "tone": {
                          "type": "string",
                          "enum": [
                            "default",
                            "primary",
                            "danger"
                          ]
                        },
                        "disabled": {
                          "type": "boolean"
                        }
                      },
                      "additionalProperties": false
                    },
                    "value": {
                      "type": "string"
                    },
                    "confirm": {
                      "type": "object",
                      "properties": {
                        "title": {
                          "type": "string"
                        },
                        "text": {
                          "type": "string"
                        },
                        "confirmText": {
                          "default": "Confirm",
                          "type": "string"
                        },
                        "denyText": {
                          "default": "Cancel",
                          "type": "string"
                        },
                        "tone": {
                          "type": "string",
                          "enum": [
                            "default",
                            "danger"
                          ]
                        }
                      },
                      "required": [
                        "text",
                        "confirmText",
                        "denyText"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "type",
                    "actionId",
                    "text"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "type",
              "elements"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "link-button"
              },
              "text": {
                "type": "string"
              },
              "url": {
                "type": "string"
              },
              "style": {
                "type": "object",
                "properties": {
                  "tone": {
                    "type": "string",
                    "enum": [
                      "default",
                      "primary",
                      "danger"
                    ]
                  },
                  "disabled": {
                    "type": "boolean"
                  }
                },
                "additionalProperties": false
              }
            },
            "required": [
              "type",
              "text",
              "url"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "field"
              },
              "label": {
                "type": "string"
              },
              "value": {
                "type": "string"
              },
              "short": {
                "type": "boolean"
              }
            },
            "required": [
              "type",
              "label",
              "value"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "context"
              },
              "elements": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "text": {
                      "type": "string"
                    },
                    "styles": {
                      "type": "object",
                      "properties": {
                        "bold": {
                          "type": "boolean"
                        },
                        "italic": {
                          "type": "boolean"
                        },
                        "strike": {
                          "type": "boolean"
                        },
                        "code": {
                          "type": "boolean"
                        }
                      },
                      "additionalProperties": false
                    },
                    "mention": {
                      "type": "object",
                      "properties": {
                        "kind": {
                          "type": "string",
                          "enum": [
                            "user",
                            "bot",
                            "channel"
                          ]
                        },
                        "id": {
                          "type": "string"
                        },
                        "label": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "kind",
                        "id"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "text"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "type",
              "elements"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "attachment"
              },
              "assetId": {
                "type": "string"
              },
              "filename": {
                "type": "string"
              },
              "contentType": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "size": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "type",
              "assetId",
              "filename"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "link-card"
              },
              "url": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "description": {
                "type": "string"
              },
              "imageUrl": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "url"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "quote"
              },
              "text": {
                "type": "string"
              },
              "cite": {
                "type": "string"
              },
              "url": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "text"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "status"
              },
              "state": {
                "type": "string",
                "enum": [
                  "info",
                  "success",
                  "warning",
                  "error",
                  "loading"
                ]
              },
              "text": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "state",
              "text"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "code"
              },
              "code": {
                "type": "string"
              },
              "language": {
                "type": "string"
              },
              "filename": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "code"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "task-list"
              },
              "title": {
                "type": "string"
              },
              "tasks": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "text": {
                      "type": "string"
                    },
                    "done": {
                      "type": "boolean"
                    }
                  },
                  "required": [
                    "text",
                    "done"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "type",
              "tasks"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "callout"
              },
              "tone": {
                "default": "info",
                "type": "string",
                "enum": [
                  "info",
                  "success",
                  "warning",
                  "danger"
                ]
              },
              "title": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "tone",
              "text"
            ],
            "additionalProperties": false
          }
        ]
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
    "channelId": {
      "type": "string"
    },
    "authorType": {
      "type": "string",
      "enum": [
        "user",
        "bot"
      ]
    },
    "userId": {
      "type": [
        "string",
        "null"
      ]
    },
    "botId": {
      "type": [
        "string",
        "null"
      ]
    },
    "authorName": {
      "type": "string"
    },
    "authorEmoji": {
      "type": [
        "string",
        "null"
      ]
    },
    "text": {
      "type": "string"
    },
    "blocks": {
      "anyOf": [
        {
          "maxItems": 50,
          "type": "array",
          "items": {
            "oneOf": [
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "markdown"
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "text"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "divider"
                  }
                },
                "required": [
                  "type"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "image"
                  },
                  "url": {
                    "type": "string"
                  },
                  "alt": {
                    "type": "string"
                  },
                  "title": {
                    "type": "string"
                  },
                  "width": {
                    "type": "integer",
                    "exclusiveMinimum": 0,
                    "maximum": 1200
                  }
                },
                "required": [
                  "type",
                  "url"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "actions"
                  },
                  "elements": {
                    "minItems": 1,
                    "maxItems": 5,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "button"
                        },
                        "actionId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "text": {
                          "type": "string"
                        },
                        "style": {
                          "type": "object",
                          "properties": {
                            "tone": {
                              "type": "string",
                              "enum": [
                                "default",
                                "primary",
                                "danger"
                              ]
                            },
                            "disabled": {
                              "type": "boolean"
                            }
                          },
                          "additionalProperties": false
                        },
                        "value": {
                          "type": "string"
                        },
                        "confirm": {
                          "type": "object",
                          "properties": {
                            "title": {
                              "type": "string"
                            },
                            "text": {
                              "type": "string"
                            },
                            "confirmText": {
                              "default": "Confirm",
                              "type": "string"
                            },
                            "denyText": {
                              "default": "Cancel",
                              "type": "string"
                            },
                            "tone": {
                              "type": "string",
                              "enum": [
                                "default",
                                "danger"
                              ]
                            }
                          },
                          "required": [
                            "text",
                            "confirmText",
                            "denyText"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "type",
                        "actionId",
                        "text"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "type",
                  "elements"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "link-button"
                  },
                  "text": {
                    "type": "string"
                  },
                  "url": {
                    "type": "string"
                  },
                  "style": {
                    "type": "object",
                    "properties": {
                      "tone": {
                        "type": "string",
                        "enum": [
                          "default",
                          "primary",
                          "danger"
                        ]
                      },
                      "disabled": {
                        "type": "boolean"
                      }
                    },
                    "additionalProperties": false
                  }
                },
                "required": [
                  "type",
                  "text",
                  "url"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "field"
                  },
                  "label": {
                    "type": "string"
                  },
                  "value": {
                    "type": "string"
                  },
                  "short": {
                    "type": "boolean"
                  }
                },
                "required": [
                  "type",
                  "label",
                  "value"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "context"
                  },
                  "elements": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "text": {
                          "type": "string"
                        },
                        "styles": {
                          "type": "object",
                          "properties": {
                            "bold": {
                              "type": "boolean"
                            },
                            "italic": {
                              "type": "boolean"
                            },
                            "strike": {
                              "type": "boolean"
                            },
                            "code": {
                              "type": "boolean"
                            }
                          },
                          "additionalProperties": false
                        },
                        "mention": {
                          "type": "object",
                          "properties": {
                            "kind": {
                              "type": "string",
                              "enum": [
                                "user",
                                "bot",
                                "channel"
                              ]
                            },
                            "id": {
                              "type": "string"
                            },
                            "label": {
                              "type": "string"
                            }
                          },
                          "required": [
                            "kind",
                            "id"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "text"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "type",
                  "elements"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "attachment"
                  },
                  "assetId": {
                    "type": "string"
                  },
                  "filename": {
                    "type": "string"
                  },
                  "contentType": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "size": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991
                  }
                },
                "required": [
                  "type",
                  "assetId",
                  "filename"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "link-card"
                  },
                  "url": {
                    "type": "string"
                  },
                  "title": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  },
                  "imageUrl": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "url"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "quote"
                  },
                  "text": {
                    "type": "string"
                  },
                  "cite": {
                    "type": "string"
                  },
                  "url": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "text"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "status"
                  },
                  "state": {
                    "type": "string",
                    "enum": [
                      "info",
                      "success",
                      "warning",
                      "error",
                      "loading"
                    ]
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "state",
                  "text"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "code"
                  },
                  "code": {
                    "type": "string"
                  },
                  "language": {
                    "type": "string"
                  },
                  "filename": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "code"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "task-list"
                  },
                  "title": {
                    "type": "string"
                  },
                  "tasks": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "text": {
                          "type": "string"
                        },
                        "done": {
                          "type": "boolean"
                        }
                      },
                      "required": [
                        "text",
                        "done"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "type",
                  "tasks"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "callout"
                  },
                  "tone": {
                    "default": "info",
                    "type": "string",
                    "enum": [
                      "info",
                      "success",
                      "warning",
                      "danger"
                    ]
                  },
                  "title": {
                    "type": "string"
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "tone",
                  "text"
                ],
                "additionalProperties": false
              }
            ]
          }
        },
        {
          "type": "null"
        }
      ]
    },
    "replyToId": {
      "type": [
        "string",
        "null"
      ]
    },
    "replyTo": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "authorName": {
              "type": "string"
            },
            "snippet": {
              "type": "string"
            }
          },
          "required": [
            "id",
            "authorName",
            "snippet"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "editedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "deletedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdAt": {
      "type": "string"
    },
    "reactions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "emoji": {
            "type": "string"
          },
          "count": {
            "type": "number"
          },
          "mine": {
            "type": "boolean"
          }
        },
        "required": [
          "emoji",
          "count",
          "mine"
        ],
        "additionalProperties": false
      }
    },
    "pinned": {
      "type": "boolean"
    },
    "saved": {
      "type": "boolean"
    }
  },
  "required": [
    "id",
    "channelId",
    "authorType",
    "userId",
    "botId",
    "authorName",
    "authorEmoji",
    "text",
    "blocks",
    "replyToId",
    "replyTo",
    "editedAt",
    "deletedAt",
    "createdAt",
    "reactions",
    "pinned",
    "saved"
  ],
  "additionalProperties": false
}
```

### `DELETE /messages/:id` — deleteMessage

Soft-deletes your own message (text/blocks cleared, tombstone kept for reply integrity).

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

### `POST /messages/:id/reactions` — toggleReaction

Toggles the caller's emoji reaction on a message; returns the full reaction summary.

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
    "emoji": {
      "type": "string",
      "minLength": 1
    }
  },
  "required": [
    "id",
    "emoji"
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
    "reactions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "emoji": {
            "type": "string"
          },
          "count": {
            "type": "number"
          },
          "mine": {
            "type": "boolean"
          }
        },
        "required": [
          "emoji",
          "count",
          "mine"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "reactions"
  ],
  "additionalProperties": false
}
```

### `POST /messages/:id/actions/:actionId` — invokeMessageAction

Invokes a button on a bot-authored composed message. The click is persisted to that bot's durable action inbox and broadcast as twochat.message.action, so agents can process it online or later.

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
    "actionId": {
      "type": "string"
    },
    "value": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "actionId"
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
    "messageId": {
      "type": "string"
    },
    "channelId": {
      "type": "string"
    },
    "botId": {
      "type": "string"
    },
    "actionId": {
      "type": "string"
    },
    "value": {
      "type": [
        "string",
        "null"
      ]
    },
    "userId": {
      "type": "string"
    },
    "acknowledgedAt": {
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
    "messageId",
    "channelId",
    "botId",
    "actionId",
    "value",
    "userId",
    "acknowledgedAt",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `POST /messages/:id/pin` — togglePin

Pins/unpins a message in its channel.

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
    "pinned": {
      "type": "boolean"
    }
  },
  "required": [
    "pinned"
  ],
  "additionalProperties": false
}
```

### `POST /messages/:id/save` — toggleSaved

Adds/removes a message from the caller's saved-for-later list.

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
    "saved": {
      "type": "boolean"
    }
  },
  "required": [
    "saved"
  ],
  "additionalProperties": false
}
```

### `GET /channels/:id/pins` — listPins

Pinned messages of a channel, newest pin first.

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
    "properties": {
      "id": {
        "type": "string"
      },
      "channelId": {
        "type": "string"
      },
      "authorType": {
        "type": "string",
        "enum": [
          "user",
          "bot"
        ]
      },
      "userId": {
        "type": [
          "string",
          "null"
        ]
      },
      "botId": {
        "type": [
          "string",
          "null"
        ]
      },
      "authorName": {
        "type": "string"
      },
      "authorEmoji": {
        "type": [
          "string",
          "null"
        ]
      },
      "text": {
        "type": "string"
      },
      "blocks": {
        "anyOf": [
          {
            "maxItems": 50,
            "type": "array",
            "items": {
              "oneOf": [
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "markdown"
                    },
                    "text": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "text"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "divider"
                    }
                  },
                  "required": [
                    "type"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "image"
                    },
                    "url": {
                      "type": "string"
                    },
                    "alt": {
                      "type": "string"
                    },
                    "title": {
                      "type": "string"
                    },
                    "width": {
                      "type": "integer",
                      "exclusiveMinimum": 0,
                      "maximum": 1200
                    }
                  },
                  "required": [
                    "type",
                    "url"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "actions"
                    },
                    "elements": {
                      "minItems": 1,
                      "maxItems": 5,
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "type": {
                            "type": "string",
                            "const": "button"
                          },
                          "actionId": {
                            "type": "string",
                            "minLength": 1
                          },
                          "text": {
                            "type": "string"
                          },
                          "style": {
                            "type": "object",
                            "properties": {
                              "tone": {
                                "type": "string",
                                "enum": [
                                  "default",
                                  "primary",
                                  "danger"
                                ]
                              },
                              "disabled": {
                                "type": "boolean"
                              }
                            },
                            "additionalProperties": false
                          },
                          "value": {
                            "type": "string"
                          },
                          "confirm": {
                            "type": "object",
                            "properties": {
                              "title": {
                                "type": "string"
                              },
                              "text": {
                                "type": "string"
                              },
                              "confirmText": {
                                "default": "Confirm",
                                "type": "string"
                              },
                              "denyText": {
                                "default": "Cancel",
                                "type": "string"
                              },
                              "tone": {
                                "type": "string",
                                "enum": [
                                  "default",
                                  "danger"
                                ]
                              }
                            },
                            "required": [
                              "text",
                              "confirmText",
                              "denyText"
                            ],
                            "additionalProperties": false
                          }
                        },
                        "required": [
                          "type",
                          "actionId",
                          "text"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "type",
                    "elements"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "link-button"
                    },
                    "text": {
                      "type": "string"
                    },
                    "url": {
                      "type": "string"
                    },
                    "style": {
                      "type": "object",
                      "properties": {
                        "tone": {
                          "type": "string",
                          "enum": [
                            "default",
                            "primary",
                            "danger"
                          ]
                        },
                        "disabled": {
                          "type": "boolean"
                        }
                      },
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "type",
                    "text",
                    "url"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "field"
                    },
                    "label": {
                      "type": "string"
                    },
                    "value": {
                      "type": "string"
                    },
                    "short": {
                      "type": "boolean"
                    }
                  },
                  "required": [
                    "type",
                    "label",
                    "value"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "context"
                    },
                    "elements": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "text": {
                            "type": "string"
                          },
                          "styles": {
                            "type": "object",
                            "properties": {
                              "bold": {
                                "type": "boolean"
                              },
                              "italic": {
                                "type": "boolean"
                              },
                              "strike": {
                                "type": "boolean"
                              },
                              "code": {
                                "type": "boolean"
                              }
                            },
                            "additionalProperties": false
                          },
                          "mention": {
                            "type": "object",
                            "properties": {
                              "kind": {
                                "type": "string",
                                "enum": [
                                  "user",
                                  "bot",
                                  "channel"
                                ]
                              },
                              "id": {
                                "type": "string"
                              },
                              "label": {
                                "type": "string"
                              }
                            },
                            "required": [
                              "kind",
                              "id"
                            ],
                            "additionalProperties": false
                          }
                        },
                        "required": [
                          "text"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "type",
                    "elements"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "attachment"
                    },
                    "assetId": {
                      "type": "string"
                    },
                    "filename": {
                      "type": "string"
                    },
                    "contentType": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "size": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    }
                  },
                  "required": [
                    "type",
                    "assetId",
                    "filename"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "link-card"
                    },
                    "url": {
                      "type": "string"
                    },
                    "title": {
                      "type": "string"
                    },
                    "description": {
                      "type": "string"
                    },
                    "imageUrl": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "url"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "quote"
                    },
                    "text": {
                      "type": "string"
                    },
                    "cite": {
                      "type": "string"
                    },
                    "url": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "text"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "status"
                    },
                    "state": {
                      "type": "string",
                      "enum": [
                        "info",
                        "success",
                        "warning",
                        "error",
                        "loading"
                      ]
                    },
                    "text": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "state",
                    "text"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "code"
                    },
                    "code": {
                      "type": "string"
                    },
                    "language": {
                      "type": "string"
                    },
                    "filename": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "code"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "task-list"
                    },
                    "title": {
                      "type": "string"
                    },
                    "tasks": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "text": {
                            "type": "string"
                          },
                          "done": {
                            "type": "boolean"
                          }
                        },
                        "required": [
                          "text",
                          "done"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "type",
                    "tasks"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "callout"
                    },
                    "tone": {
                      "default": "info",
                      "type": "string",
                      "enum": [
                        "info",
                        "success",
                        "warning",
                        "danger"
                      ]
                    },
                    "title": {
                      "type": "string"
                    },
                    "text": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "tone",
                    "text"
                  ],
                  "additionalProperties": false
                }
              ]
            }
          },
          {
            "type": "null"
          }
        ]
      },
      "replyToId": {
        "type": [
          "string",
          "null"
        ]
      },
      "replyTo": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "authorName": {
                "type": "string"
              },
              "snippet": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "authorName",
              "snippet"
            ],
            "additionalProperties": false
          },
          {
            "type": "null"
          }
        ]
      },
      "editedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "deletedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "type": "string"
      },
      "reactions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "emoji": {
              "type": "string"
            },
            "count": {
              "type": "number"
            },
            "mine": {
              "type": "boolean"
            }
          },
          "required": [
            "emoji",
            "count",
            "mine"
          ],
          "additionalProperties": false
        }
      },
      "pinned": {
        "type": "boolean"
      },
      "saved": {
        "type": "boolean"
      }
    },
    "required": [
      "id",
      "channelId",
      "authorType",
      "userId",
      "botId",
      "authorName",
      "authorEmoji",
      "text",
      "blocks",
      "replyToId",
      "replyTo",
      "editedAt",
      "deletedAt",
      "createdAt",
      "reactions",
      "pinned",
      "saved"
    ],
    "additionalProperties": false
  }
}
```

### `GET /saved` — listSaved

Everything the caller saved, across channels.

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
      "channelId": {
        "type": "string"
      },
      "authorType": {
        "type": "string",
        "enum": [
          "user",
          "bot"
        ]
      },
      "userId": {
        "type": [
          "string",
          "null"
        ]
      },
      "botId": {
        "type": [
          "string",
          "null"
        ]
      },
      "authorName": {
        "type": "string"
      },
      "authorEmoji": {
        "type": [
          "string",
          "null"
        ]
      },
      "text": {
        "type": "string"
      },
      "blocks": {
        "anyOf": [
          {
            "maxItems": 50,
            "type": "array",
            "items": {
              "oneOf": [
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "markdown"
                    },
                    "text": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "text"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "divider"
                    }
                  },
                  "required": [
                    "type"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "image"
                    },
                    "url": {
                      "type": "string"
                    },
                    "alt": {
                      "type": "string"
                    },
                    "title": {
                      "type": "string"
                    },
                    "width": {
                      "type": "integer",
                      "exclusiveMinimum": 0,
                      "maximum": 1200
                    }
                  },
                  "required": [
                    "type",
                    "url"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "actions"
                    },
                    "elements": {
                      "minItems": 1,
                      "maxItems": 5,
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "type": {
                            "type": "string",
                            "const": "button"
                          },
                          "actionId": {
                            "type": "string",
                            "minLength": 1
                          },
                          "text": {
                            "type": "string"
                          },
                          "style": {
                            "type": "object",
                            "properties": {
                              "tone": {
                                "type": "string",
                                "enum": [
                                  "default",
                                  "primary",
                                  "danger"
                                ]
                              },
                              "disabled": {
                                "type": "boolean"
                              }
                            },
                            "additionalProperties": false
                          },
                          "value": {
                            "type": "string"
                          },
                          "confirm": {
                            "type": "object",
                            "properties": {
                              "title": {
                                "type": "string"
                              },
                              "text": {
                                "type": "string"
                              },
                              "confirmText": {
                                "default": "Confirm",
                                "type": "string"
                              },
                              "denyText": {
                                "default": "Cancel",
                                "type": "string"
                              },
                              "tone": {
                                "type": "string",
                                "enum": [
                                  "default",
                                  "danger"
                                ]
                              }
                            },
                            "required": [
                              "text",
                              "confirmText",
                              "denyText"
                            ],
                            "additionalProperties": false
                          }
                        },
                        "required": [
                          "type",
                          "actionId",
                          "text"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "type",
                    "elements"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "link-button"
                    },
                    "text": {
                      "type": "string"
                    },
                    "url": {
                      "type": "string"
                    },
                    "style": {
                      "type": "object",
                      "properties": {
                        "tone": {
                          "type": "string",
                          "enum": [
                            "default",
                            "primary",
                            "danger"
                          ]
                        },
                        "disabled": {
                          "type": "boolean"
                        }
                      },
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "type",
                    "text",
                    "url"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "field"
                    },
                    "label": {
                      "type": "string"
                    },
                    "value": {
                      "type": "string"
                    },
                    "short": {
                      "type": "boolean"
                    }
                  },
                  "required": [
                    "type",
                    "label",
                    "value"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "context"
                    },
                    "elements": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "text": {
                            "type": "string"
                          },
                          "styles": {
                            "type": "object",
                            "properties": {
                              "bold": {
                                "type": "boolean"
                              },
                              "italic": {
                                "type": "boolean"
                              },
                              "strike": {
                                "type": "boolean"
                              },
                              "code": {
                                "type": "boolean"
                              }
                            },
                            "additionalProperties": false
                          },
                          "mention": {
                            "type": "object",
                            "properties": {
                              "kind": {
                                "type": "string",
                                "enum": [
                                  "user",
                                  "bot",
                                  "channel"
                                ]
                              },
                              "id": {
                                "type": "string"
                              },
                              "label": {
                                "type": "string"
                              }
                            },
                            "required": [
                              "kind",
                              "id"
                            ],
                            "additionalProperties": false
                          }
                        },
                        "required": [
                          "text"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "type",
                    "elements"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "attachment"
                    },
                    "assetId": {
                      "type": "string"
                    },
                    "filename": {
                      "type": "string"
                    },
                    "contentType": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "size": {
                      "type": "integer",
                      "minimum": 0,
                      "maximum": 9007199254740991
                    }
                  },
                  "required": [
                    "type",
                    "assetId",
                    "filename"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "link-card"
                    },
                    "url": {
                      "type": "string"
                    },
                    "title": {
                      "type": "string"
                    },
                    "description": {
                      "type": "string"
                    },
                    "imageUrl": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "url"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "quote"
                    },
                    "text": {
                      "type": "string"
                    },
                    "cite": {
                      "type": "string"
                    },
                    "url": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "text"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "status"
                    },
                    "state": {
                      "type": "string",
                      "enum": [
                        "info",
                        "success",
                        "warning",
                        "error",
                        "loading"
                      ]
                    },
                    "text": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "state",
                    "text"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "code"
                    },
                    "code": {
                      "type": "string"
                    },
                    "language": {
                      "type": "string"
                    },
                    "filename": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "code"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "task-list"
                    },
                    "title": {
                      "type": "string"
                    },
                    "tasks": {
                      "minItems": 1,
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "text": {
                            "type": "string"
                          },
                          "done": {
                            "type": "boolean"
                          }
                        },
                        "required": [
                          "text",
                          "done"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "type",
                    "tasks"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "callout"
                    },
                    "tone": {
                      "default": "info",
                      "type": "string",
                      "enum": [
                        "info",
                        "success",
                        "warning",
                        "danger"
                      ]
                    },
                    "title": {
                      "type": "string"
                    },
                    "text": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "type",
                    "tone",
                    "text"
                  ],
                  "additionalProperties": false
                }
              ]
            }
          },
          {
            "type": "null"
          }
        ]
      },
      "replyToId": {
        "type": [
          "string",
          "null"
        ]
      },
      "replyTo": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "authorName": {
                "type": "string"
              },
              "snippet": {
                "type": "string"
              }
            },
            "required": [
              "id",
              "authorName",
              "snippet"
            ],
            "additionalProperties": false
          },
          {
            "type": "null"
          }
        ]
      },
      "editedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "deletedAt": {
        "type": [
          "string",
          "null"
        ]
      },
      "createdAt": {
        "type": "string"
      },
      "reactions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "emoji": {
              "type": "string"
            },
            "count": {
              "type": "number"
            },
            "mine": {
              "type": "boolean"
            }
          },
          "required": [
            "emoji",
            "count",
            "mine"
          ],
          "additionalProperties": false
        }
      },
      "pinned": {
        "type": "boolean"
      },
      "saved": {
        "type": "boolean"
      }
    },
    "required": [
      "id",
      "channelId",
      "authorType",
      "userId",
      "botId",
      "authorName",
      "authorEmoji",
      "text",
      "blocks",
      "replyToId",
      "replyTo",
      "editedAt",
      "deletedAt",
      "createdAt",
      "reactions",
      "pinned",
      "saved"
    ],
    "additionalProperties": false
  }
}
```

### `GET /drafts/:channelId` — getDraft

The caller's unsent draft text for a channel (empty string when none).

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "channelId": {
      "type": "string"
    }
  },
  "required": [
    "channelId"
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
    }
  },
  "required": [
    "text"
  ],
  "additionalProperties": false
}
```

### `PUT /drafts/:channelId` — saveDraft

Persists the caller's draft for a channel (survives reloads/tab switches).

- **Auth**: `session`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "channelId": {
      "type": "string"
    },
    "text": {
      "type": "string"
    }
  },
  "required": [
    "channelId",
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

### `POST /channels/:id/read` — markRead

Advances the caller's read cursor for a channel (also arrives over WS as a `read` frame).

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
    "messageId": {
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

### `POST /channels/:id/assets` — uploadAssets

Multipart upload of one or more files into a channel. Stored via the storage adapter (TwoDrive S3 stub / local fs today). Returns asset payloads to embed as attachment blocks.

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
    "assets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "channelId": {
            "type": [
              "string",
              "null"
            ]
          },
          "filename": {
            "type": "string"
          },
          "contentType": {
            "type": [
              "string",
              "null"
            ]
          },
          "size": {
            "type": "number"
          },
          "createdAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "channelId",
          "filename",
          "contentType",
          "size",
          "createdAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "assets"
  ],
  "additionalProperties": false
}
```

### `GET /assets/:id` — getAsset

Streams an attachment's bytes (auth-checked; blobs are never publicly addressed).

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

### `GET /channels/:id/assets` — listAssets

Files shared in a channel.

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
    "properties": {
      "id": {
        "type": "string"
      },
      "channelId": {
        "type": [
          "string",
          "null"
        ]
      },
      "filename": {
        "type": "string"
      },
      "contentType": {
        "type": [
          "string",
          "null"
        ]
      },
      "size": {
        "type": "number"
      },
      "createdAt": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "channelId",
      "filename",
      "contentType",
      "size",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `GET /bots` — listBots

Agent/bot participants of the workspace (name, avatar emoji, kind).

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
      "kind": {
        "type": "string"
      },
      "avatarEmoji": {
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
      "createdAt": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "name",
      "kind",
      "avatarEmoji",
      "description",
      "createdAt"
    ],
    "additionalProperties": false
  }
}
```

### `POST /bots` — createBot

Registers a bot participant. `apiKeyId` binds a workspace API key (from TwoDB control plane) so the agent can post via /bots/webhook.

- **Auth**: `session`

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
    "kind": {
      "type": "string"
    },
    "apiKeyId": {
      "type": "string"
    },
    "avatarEmoji": {
      "type": "string"
    },
    "description": {
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
    "name": {
      "type": "string"
    },
    "kind": {
      "type": "string"
    },
    "avatarEmoji": {
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
    "createdAt": {
      "type": "string"
    }
  },
  "required": [
    "id",
    "name",
    "kind",
    "avatarEmoji",
    "description",
    "createdAt"
  ],
  "additionalProperties": false
}
```

### `POST /bots/webhook` — botWebhook

THE agent participation endpoint. Auth = workspace API key bound to a bot. Posts a composed message (blocks or text) into `channelId`/`channelName`, auto-joins the bot to the channel, fans out over WS and notifies mentioned users — identical treatment to human messages. This is how agents become chat citizens: they read via listMessages and reply via this.

- **Auth**: `apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "channelId": {
      "type": "string"
    },
    "channelName": {
      "type": "string"
    },
    "text": {
      "type": "string"
    },
    "blocks": {
      "maxItems": 50,
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "markdown"
              },
              "text": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "text"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "divider"
              }
            },
            "required": [
              "type"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "image"
              },
              "url": {
                "type": "string"
              },
              "alt": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "width": {
                "type": "integer",
                "exclusiveMinimum": 0,
                "maximum": 1200
              }
            },
            "required": [
              "type",
              "url"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "actions"
              },
              "elements": {
                "minItems": 1,
                "maxItems": 5,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "type": {
                      "type": "string",
                      "const": "button"
                    },
                    "actionId": {
                      "type": "string",
                      "minLength": 1
                    },
                    "text": {
                      "type": "string"
                    },
                    "style": {
                      "type": "object",
                      "properties": {
                        "tone": {
                          "type": "string",
                          "enum": [
                            "default",
                            "primary",
                            "danger"
                          ]
                        },
                        "disabled": {
                          "type": "boolean"
                        }
                      },
                      "additionalProperties": false
                    },
                    "value": {
                      "type": "string"
                    },
                    "confirm": {
                      "type": "object",
                      "properties": {
                        "title": {
                          "type": "string"
                        },
                        "text": {
                          "type": "string"
                        },
                        "confirmText": {
                          "default": "Confirm",
                          "type": "string"
                        },
                        "denyText": {
                          "default": "Cancel",
                          "type": "string"
                        },
                        "tone": {
                          "type": "string",
                          "enum": [
                            "default",
                            "danger"
                          ]
                        }
                      },
                      "required": [
                        "text",
                        "confirmText",
                        "denyText"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "type",
                    "actionId",
                    "text"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "type",
              "elements"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "link-button"
              },
              "text": {
                "type": "string"
              },
              "url": {
                "type": "string"
              },
              "style": {
                "type": "object",
                "properties": {
                  "tone": {
                    "type": "string",
                    "enum": [
                      "default",
                      "primary",
                      "danger"
                    ]
                  },
                  "disabled": {
                    "type": "boolean"
                  }
                },
                "additionalProperties": false
              }
            },
            "required": [
              "type",
              "text",
              "url"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "field"
              },
              "label": {
                "type": "string"
              },
              "value": {
                "type": "string"
              },
              "short": {
                "type": "boolean"
              }
            },
            "required": [
              "type",
              "label",
              "value"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "context"
              },
              "elements": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "text": {
                      "type": "string"
                    },
                    "styles": {
                      "type": "object",
                      "properties": {
                        "bold": {
                          "type": "boolean"
                        },
                        "italic": {
                          "type": "boolean"
                        },
                        "strike": {
                          "type": "boolean"
                        },
                        "code": {
                          "type": "boolean"
                        }
                      },
                      "additionalProperties": false
                    },
                    "mention": {
                      "type": "object",
                      "properties": {
                        "kind": {
                          "type": "string",
                          "enum": [
                            "user",
                            "bot",
                            "channel"
                          ]
                        },
                        "id": {
                          "type": "string"
                        },
                        "label": {
                          "type": "string"
                        }
                      },
                      "required": [
                        "kind",
                        "id"
                      ],
                      "additionalProperties": false
                    }
                  },
                  "required": [
                    "text"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "type",
              "elements"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "attachment"
              },
              "assetId": {
                "type": "string"
              },
              "filename": {
                "type": "string"
              },
              "contentType": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "size": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991
              }
            },
            "required": [
              "type",
              "assetId",
              "filename"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "link-card"
              },
              "url": {
                "type": "string"
              },
              "title": {
                "type": "string"
              },
              "description": {
                "type": "string"
              },
              "imageUrl": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "url"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "quote"
              },
              "text": {
                "type": "string"
              },
              "cite": {
                "type": "string"
              },
              "url": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "text"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "status"
              },
              "state": {
                "type": "string",
                "enum": [
                  "info",
                  "success",
                  "warning",
                  "error",
                  "loading"
                ]
              },
              "text": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "state",
              "text"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "code"
              },
              "code": {
                "type": "string"
              },
              "language": {
                "type": "string"
              },
              "filename": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "code"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "task-list"
              },
              "title": {
                "type": "string"
              },
              "tasks": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "text": {
                      "type": "string"
                    },
                    "done": {
                      "type": "boolean"
                    }
                  },
                  "required": [
                    "text",
                    "done"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "type",
              "tasks"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "const": "callout"
              },
              "tone": {
                "default": "info",
                "type": "string",
                "enum": [
                  "info",
                  "success",
                  "warning",
                  "danger"
                ]
              },
              "title": {
                "type": "string"
              },
              "text": {
                "type": "string"
              }
            },
            "required": [
              "type",
              "tone",
              "text"
            ],
            "additionalProperties": false
          }
        ]
      }
    },
    "replyToId": {
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
    "id": {
      "type": "string"
    },
    "channelId": {
      "type": "string"
    },
    "authorType": {
      "type": "string",
      "enum": [
        "user",
        "bot"
      ]
    },
    "userId": {
      "type": [
        "string",
        "null"
      ]
    },
    "botId": {
      "type": [
        "string",
        "null"
      ]
    },
    "authorName": {
      "type": "string"
    },
    "authorEmoji": {
      "type": [
        "string",
        "null"
      ]
    },
    "text": {
      "type": "string"
    },
    "blocks": {
      "anyOf": [
        {
          "maxItems": 50,
          "type": "array",
          "items": {
            "oneOf": [
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "markdown"
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "text"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "divider"
                  }
                },
                "required": [
                  "type"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "image"
                  },
                  "url": {
                    "type": "string"
                  },
                  "alt": {
                    "type": "string"
                  },
                  "title": {
                    "type": "string"
                  },
                  "width": {
                    "type": "integer",
                    "exclusiveMinimum": 0,
                    "maximum": 1200
                  }
                },
                "required": [
                  "type",
                  "url"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "actions"
                  },
                  "elements": {
                    "minItems": 1,
                    "maxItems": 5,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "type": {
                          "type": "string",
                          "const": "button"
                        },
                        "actionId": {
                          "type": "string",
                          "minLength": 1
                        },
                        "text": {
                          "type": "string"
                        },
                        "style": {
                          "type": "object",
                          "properties": {
                            "tone": {
                              "type": "string",
                              "enum": [
                                "default",
                                "primary",
                                "danger"
                              ]
                            },
                            "disabled": {
                              "type": "boolean"
                            }
                          },
                          "additionalProperties": false
                        },
                        "value": {
                          "type": "string"
                        },
                        "confirm": {
                          "type": "object",
                          "properties": {
                            "title": {
                              "type": "string"
                            },
                            "text": {
                              "type": "string"
                            },
                            "confirmText": {
                              "default": "Confirm",
                              "type": "string"
                            },
                            "denyText": {
                              "default": "Cancel",
                              "type": "string"
                            },
                            "tone": {
                              "type": "string",
                              "enum": [
                                "default",
                                "danger"
                              ]
                            }
                          },
                          "required": [
                            "text",
                            "confirmText",
                            "denyText"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "type",
                        "actionId",
                        "text"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "type",
                  "elements"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "link-button"
                  },
                  "text": {
                    "type": "string"
                  },
                  "url": {
                    "type": "string"
                  },
                  "style": {
                    "type": "object",
                    "properties": {
                      "tone": {
                        "type": "string",
                        "enum": [
                          "default",
                          "primary",
                          "danger"
                        ]
                      },
                      "disabled": {
                        "type": "boolean"
                      }
                    },
                    "additionalProperties": false
                  }
                },
                "required": [
                  "type",
                  "text",
                  "url"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "field"
                  },
                  "label": {
                    "type": "string"
                  },
                  "value": {
                    "type": "string"
                  },
                  "short": {
                    "type": "boolean"
                  }
                },
                "required": [
                  "type",
                  "label",
                  "value"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "context"
                  },
                  "elements": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "text": {
                          "type": "string"
                        },
                        "styles": {
                          "type": "object",
                          "properties": {
                            "bold": {
                              "type": "boolean"
                            },
                            "italic": {
                              "type": "boolean"
                            },
                            "strike": {
                              "type": "boolean"
                            },
                            "code": {
                              "type": "boolean"
                            }
                          },
                          "additionalProperties": false
                        },
                        "mention": {
                          "type": "object",
                          "properties": {
                            "kind": {
                              "type": "string",
                              "enum": [
                                "user",
                                "bot",
                                "channel"
                              ]
                            },
                            "id": {
                              "type": "string"
                            },
                            "label": {
                              "type": "string"
                            }
                          },
                          "required": [
                            "kind",
                            "id"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "text"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "type",
                  "elements"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "attachment"
                  },
                  "assetId": {
                    "type": "string"
                  },
                  "filename": {
                    "type": "string"
                  },
                  "contentType": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "size": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991
                  }
                },
                "required": [
                  "type",
                  "assetId",
                  "filename"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "link-card"
                  },
                  "url": {
                    "type": "string"
                  },
                  "title": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  },
                  "imageUrl": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "url"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "quote"
                  },
                  "text": {
                    "type": "string"
                  },
                  "cite": {
                    "type": "string"
                  },
                  "url": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "text"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "status"
                  },
                  "state": {
                    "type": "string",
                    "enum": [
                      "info",
                      "success",
                      "warning",
                      "error",
                      "loading"
                    ]
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "state",
                  "text"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "code"
                  },
                  "code": {
                    "type": "string"
                  },
                  "language": {
                    "type": "string"
                  },
                  "filename": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "code"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "task-list"
                  },
                  "title": {
                    "type": "string"
                  },
                  "tasks": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "text": {
                          "type": "string"
                        },
                        "done": {
                          "type": "boolean"
                        }
                      },
                      "required": [
                        "text",
                        "done"
                      ],
                      "additionalProperties": false
                    }
                  }
                },
                "required": [
                  "type",
                  "tasks"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string",
                    "const": "callout"
                  },
                  "tone": {
                    "default": "info",
                    "type": "string",
                    "enum": [
                      "info",
                      "success",
                      "warning",
                      "danger"
                    ]
                  },
                  "title": {
                    "type": "string"
                  },
                  "text": {
                    "type": "string"
                  }
                },
                "required": [
                  "type",
                  "tone",
                  "text"
                ],
                "additionalProperties": false
              }
            ]
          }
        },
        {
          "type": "null"
        }
      ]
    },
    "replyToId": {
      "type": [
        "string",
        "null"
      ]
    },
    "replyTo": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "authorName": {
              "type": "string"
            },
            "snippet": {
              "type": "string"
            }
          },
          "required": [
            "id",
            "authorName",
            "snippet"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    },
    "editedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "deletedAt": {
      "type": [
        "string",
        "null"
      ]
    },
    "createdAt": {
      "type": "string"
    },
    "reactions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "emoji": {
            "type": "string"
          },
          "count": {
            "type": "number"
          },
          "mine": {
            "type": "boolean"
          }
        },
        "required": [
          "emoji",
          "count",
          "mine"
        ],
        "additionalProperties": false
      }
    },
    "pinned": {
      "type": "boolean"
    },
    "saved": {
      "type": "boolean"
    }
  },
  "required": [
    "id",
    "channelId",
    "authorType",
    "userId",
    "botId",
    "authorName",
    "authorEmoji",
    "text",
    "blocks",
    "replyToId",
    "replyTo",
    "editedAt",
    "deletedAt",
    "createdAt",
    "reactions",
    "pinned",
    "saved"
  ],
  "additionalProperties": false
}
```

### `GET /bots/actions` — listBotActions

Durable inbox of interactive message button clicks addressed to the calling bot. Unacknowledged only by default.

- **Auth**: `apiKey`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "includeAcknowledged": {
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
    "actions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "messageId": {
            "type": "string"
          },
          "channelId": {
            "type": "string"
          },
          "botId": {
            "type": "string"
          },
          "actionId": {
            "type": "string"
          },
          "value": {
            "type": [
              "string",
              "null"
            ]
          },
          "userId": {
            "type": "string"
          },
          "acknowledgedAt": {
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
          "messageId",
          "channelId",
          "botId",
          "actionId",
          "value",
          "userId",
          "acknowledgedAt",
          "createdAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "actions"
  ],
  "additionalProperties": false
}
```

### `POST /bots/actions/:id/ack` — acknowledgeBotAction

Marks one interactive-message action processed by the calling bot.

- **Auth**: `apiKey`

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

### `GET /notifications` — listNotifications

The caller's notification inbox (mentions, DMs, bot posts) with unread count.

- **Auth**: `session`

**Response**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "notifications": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "kind": {
            "type": "string",
            "enum": [
              "mention",
              "dm",
              "channel",
              "bot-post",
              "system"
            ]
          },
          "title": {
            "type": "string"
          },
          "body": {
            "type": "string"
          },
          "channelId": {
            "type": [
              "string",
              "null"
            ]
          },
          "messageId": {
            "type": [
              "string",
              "null"
            ]
          },
          "readAt": {
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
          "kind",
          "title",
          "body",
          "channelId",
          "messageId",
          "readAt",
          "createdAt"
        ],
        "additionalProperties": false
      }
    },
    "unread": {
      "type": "number"
    }
  },
  "required": [
    "notifications",
    "unread"
  ],
  "additionalProperties": false
}
```

### `POST /notifications/:id/read` — markNotificationRead

Marks one notification read.

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

### `POST /notifications/read-all` — markAllNotificationsRead

Marks the whole inbox read.

- **Auth**: `session`

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

### `GET /search` — search

Full-text-ish message search (ILIKE over the text projection) feeding the Gateway's federated search fan-out.

- **Auth**: `session-or-apiKey`
- **Capability**: `search`

**Request**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "q": {
      "type": "string"
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
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "snippet": {
            "type": "string"
          },
          "url": {
            "type": "string"
          },
          "channelId": {
            "type": "string"
          },
          "createdAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "title",
          "snippet",
          "url",
          "channelId",
          "createdAt"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "results"
  ],
  "additionalProperties": false
}
```
