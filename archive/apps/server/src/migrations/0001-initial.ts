import { sql, type Kysely } from "kysely";

// Baseline: the full twodb schema as of the migration reintroduction.
// Databases created by the old self-bootstrapping DDL are seeded past this
// migration at startup (see lib/migrate.ts), so it only runs on fresh databases.

export async function up(db: Kysely<unknown>): Promise<void> {
  const timestamptz = "timestamptz" as const;
  const timestamp = "timestamp" as const;
  const jsonb = "jsonb" as const;
  const text = "text" as const;
  const integer = "integer" as const;
  const boolean = "boolean" as const;
  const doublePrecision = "double precision" as const;
  const bigint = "bigint" as const;
  const textArray = sql`text[]`;

  await db.schema
    .createTable("account")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("accountId", text, (c) => c.notNull())
    .addColumn("providerId", text, (c) => c.notNull())
    .addColumn("userId", text, (c) => c.notNull())
    .addColumn("accessToken", text)
    .addColumn("refreshToken", text)
    .addColumn("idToken", text)
    .addColumn("accessTokenExpiresAt", timestamptz)
    .addColumn("refreshTokenExpiresAt", timestamptz)
    .addColumn("scope", text)
    .addColumn("password", text)
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("account_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("agent")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("codeDirectoryId", text)
    .addColumn("provider", text, (c) => c.notNull())
    .addColumn("model", text, (c) => c.notNull())
    .addColumn("description", text)
    .addColumn("instruction", text, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("agent_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("api_key")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("userId", text, (c) => c.notNull())
    .addColumn("name", text, (c) => c.notNull())
    .addColumn("prefix", text, (c) => c.notNull())
    .addColumn("hash", text, (c) => c.notNull())
    .addColumn("lastUsedAt", timestamptz)
    .addColumn("revokedAt", timestamptz)
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("api_key_pkey", ["id"])
    .addUniqueConstraint("api_key_hash_key", ["hash"])
    .execute();

  await db.schema
    .createTable("apikey")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("configId", text, (c) => c.defaultTo("default").notNull())
    .addColumn("name", text)
    .addColumn("start", text)
    .addColumn("referenceId", text, (c) => c.notNull())
    .addColumn("prefix", text)
    .addColumn("key", text, (c) => c.notNull())
    .addColumn("refillInterval", integer)
    .addColumn("refillAmount", integer)
    .addColumn("lastRefillAt", timestamptz)
    .addColumn("enabled", boolean, (c) => c.defaultTo(true))
    .addColumn("rateLimitEnabled", boolean, (c) => c.defaultTo(true))
    .addColumn("rateLimitTimeWindow", integer, (c) => c.defaultTo(86400000))
    .addColumn("rateLimitMax", integer, (c) => c.defaultTo(10))
    .addColumn("requestCount", integer, (c) => c.defaultTo(0))
    .addColumn("remaining", integer)
    .addColumn("lastRequest", timestamptz)
    .addColumn("expiresAt", timestamptz)
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addColumn("permissions", text)
    .addColumn("metadata", text)
    .addPrimaryKeyConstraint("apikey_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("assistant_artifact")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("threadId", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("title", text, (c) => c.notNull())
    .addColumn("type", text, (c) => c.notNull())
    .addColumn("content", text, (c) => c.notNull())
    .addColumn("createdAt", timestamp, (c) => c.notNull())
    .addColumn("updatedAt", timestamp, (c) => c.notNull())
    .addPrimaryKeyConstraint("assistant_artifact_pkey", ["id"])
    .addUniqueConstraint("assistant_artifact_unique_title", ["threadId", "title"])
    .execute();

  await db.schema
    .createTable("assistant_message")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("threadId", text, (c) => c.notNull())
    .addColumn("role", text, (c) => c.notNull())
    .addColumn("content", text, (c) => c.notNull())
    .addColumn("meta", jsonb)
    .addColumn("createdAt", timestamp, (c) => c.notNull())
    .addPrimaryKeyConstraint("assistant_message_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("assistant_thread")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("title", text, (c) => c.notNull())
    .addColumn("connectionId", text)
    .addColumn("model", text)
    .addColumn("createdAt", timestamp, (c) => c.notNull())
    .addColumn("updatedAt", timestamp, (c) => c.notNull())
    .addPrimaryKeyConstraint("assistant_thread_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("code_directory")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("runnerId", text, (c) => c.notNull())
    .addColumn("cwd", text, (c) => c.notNull())
    .addColumn("displayName", text, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("code_directory_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("code_session")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("title", text, (c) => c.notNull())
    .addColumn("connectionId", text)
    .addColumn("model", text)
    .addColumn("codeDirectoryId", text)
    .addColumn("type", text, (c) => c.defaultTo("main_agent").notNull())
    .addColumn("parentSessionId", text)
    .addColumn("agentId", text)
    .addColumn("mode", jsonb)
    .addColumn("runtimeState", jsonb)
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("code_session_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("code_session_message")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("sessionId", text, (c) => c.notNull())
    .addColumn("role", text, (c) => c.notNull())
    .addColumn("content", text, (c) => c.notNull())
    .addColumn("meta", jsonb)
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("code_session_message_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("code_session_usage_event")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("sessionId", text, (c) => c.notNull())
    .addColumn("connectionId", text, (c) => c.notNull())
    .addColumn("model", text, (c) => c.notNull())
    .addColumn("inputTokens", integer, (c) => c.defaultTo(0).notNull())
    .addColumn("outputTokens", integer, (c) => c.defaultTo(0).notNull())
    .addColumn("cachedInputTokens", integer, (c) => c.defaultTo(0).notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("code_session_usage_event_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("device")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("userId", text, (c) => c.notNull())
    .addColumn("name", text, (c) => c.defaultTo("").notNull())
    .addColumn("platform", text, (c) => c.notNull())
    .addColumn("token", text, (c) => c.notNull())
    .addColumn("lastSeenAt", timestamptz, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("device_pkey", ["id"])
    .addUniqueConstraint("device_token_key", ["token"])
    .execute();

  await db.schema
    .createTable("instruction")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("codeDirectoryId", text)
    .addColumn("instruction", text, (c) => c.notNull())
    .addColumn("instructionPath", text, (c) => c.notNull())
    .addColumn("hash", text, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("instruction_pkey", ["id"])
    .addUniqueConstraint("instruction_scope_path_unique", ["organizationId", "codeDirectoryId", "instructionPath"], (c) => c.nullsNotDistinct())
    .execute();

  await db.schema
    .createTable("invitation")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("email", text, (c) => c.notNull())
    .addColumn("role", text)
    .addColumn("status", text, (c) => c.defaultTo("pending").notNull())
    .addColumn("expiresAt", timestamptz, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("inviterId", text, (c) => c.notNull())
    .addPrimaryKeyConstraint("invitation_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("llm_connection")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("provider", text, (c) => c.notNull())
    .addColumn("name", text, (c) => c.notNull())
    .addColumn("config", jsonb, (c) => c.defaultTo(sql`'{}'::jsonb`).notNull())
    .addColumn("enabled", boolean, (c) => c.defaultTo(true).notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("llm_connection_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("llm_model")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("connectionId", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("modelId", text, (c) => c.notNull())
    .addColumn("displayName", text)
    .addColumn("contextWindow", integer)
    .addColumn("thinking", boolean, (c) => c.defaultTo(false).notNull())
    .addColumn("input", textArray, (c) => c.defaultTo(sql`'{}'::text[]`).notNull())
    .addColumn("thinkingLevel", textArray, (c) => c.defaultTo(sql`'{}'::text[]`).notNull())
    .addColumn("temperature", boolean, (c) => c.defaultTo(false).notNull())
    .addColumn("limitContext", integer)
    .addColumn("limitInput", integer)
    .addColumn("limitOutput", integer)
    .addColumn("costInput", doublePrecision)
    .addColumn("costOutput", doublePrecision)
    .addColumn("costCacheRead", doublePrecision)
    .addColumn("output", textArray, (c) => c.defaultTo(sql`'{}'::text[]`).notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("llm_model_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("llm_quota")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("connectionId", text, (c) => c.notNull())
    .addColumn("quotaType", text, (c) => c.notNull())
    .addColumn("groupName", text, (c) => c.defaultTo("default").notNull())
    .addColumn("unit", text, (c) => c.defaultTo("tokens").notNull())
    .addColumn("quotaTotal", doublePrecision)
    .addColumn("quotaUsed", doublePrecision, (c) => c.notNull())
    .addColumn("capturedAt", timestamptz, (c) => c.notNull())
    .addColumn("resetAt", timestamptz)
    .addUniqueConstraint("llm_quota_connection_type_group_unique", ["connectionId", "quotaType", "groupName"])
    .execute();

  await db.schema.createIndex("llm_quota_connection_idx").ifNotExists().on("llm_quota").column("connectionId").execute();

  await db.schema
    .createTable("llm_usage_event")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("connectionId", text, (c) => c.notNull())
    .addColumn("correlationId", text)
    .addColumn("model", text, (c) => c.notNull())
    .addColumn("inputTokens", integer, (c) => c.defaultTo(0).notNull())
    .addColumn("outputTokens", integer, (c) => c.defaultTo(0).notNull())
    .addColumn("cachedInputTokens", integer, (c) => c.defaultTo(0).notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("llm_usage_event_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("member")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("userId", text, (c) => c.notNull())
    .addColumn("role", text, (c) => c.defaultTo("member").notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("member_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("memory")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("codeDirectoryId", text)
    .addColumn("scopeId", text)
    .addColumn("tags", textArray, (c) => c.defaultTo(sql`'{}'::text[]`).notNull())
    .addColumn("content", text, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("memory_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("note_item")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("nodeId", text, (c) => c.notNull())
    .addColumn("title", text, (c) => c.defaultTo("").notNull())
    .addColumn("content", jsonb, (c) => c.defaultTo(sql`'{}'::jsonb`).notNull())
    .addColumn("preview", text, (c) => c.defaultTo("").notNull())
    .addColumn("createdAt", timestamp, (c) => c.notNull())
    .addColumn("updatedAt", timestamp, (c) => c.notNull())
    .addPrimaryKeyConstraint("note_item_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("note_node")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("parentId", text)
    .addColumn("kind", text, (c) => c.notNull())
    .addColumn("name", text, (c) => c.notNull())
    .addColumn("position", integer, (c) => c.defaultTo(0).notNull())
    .addColumn("isFavorite", boolean, (c) => c.defaultTo(false).notNull())
    .addColumn("metadata", jsonb)
    .addColumn("createdAt", timestamp, (c) => c.notNull())
    .addColumn("updatedAt", timestamp, (c) => c.notNull())
    .addPrimaryKeyConstraint("note_node_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("notification")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("userId", text, (c) => c.notNull())
    .addColumn("title", text, (c) => c.notNull())
    .addColumn("body", text, (c) => c.defaultTo("").notNull())
    .addColumn("data", jsonb)
    .addColumn("readAt", timestamptz)
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("notification_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("organization")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("name", text, (c) => c.notNull())
    .addColumn("slug", text, (c) => c.notNull())
    .addColumn("logo", text)
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("metadata", text)
    .addPrimaryKeyConstraint("organization_pkey", ["id"])
    .addUniqueConstraint("organization_slug_key", ["slug"])
    .execute();

  await db.schema
    .createTable("passkey")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("name", text)
    .addColumn("publicKey", text, (c) => c.notNull())
    .addColumn("userId", text, (c) => c.notNull())
    .addColumn("credentialID", text, (c) => c.notNull())
    .addColumn("counter", integer, (c) => c.notNull())
    .addColumn("deviceType", text, (c) => c.notNull())
    .addColumn("backedUp", boolean, (c) => c.notNull())
    .addColumn("transports", text)
    .addColumn("createdAt", timestamptz)
    .addColumn("aaguid", text)
    .addPrimaryKeyConstraint("passkey_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("runner")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("accessKeyId", text, (c) => c.notNull())
    .addColumn("name", text, (c) => c.notNull())
    .addColumn("hostname", text)
    .addColumn("lastSeenAt", timestamptz, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("deletedAt", timestamptz)
    .addPrimaryKeyConstraint("runner_pkey", ["id"])
    .execute();

  await db.schema
    .createTable("runner_access_key")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("name", text, (c) => c.notNull())
    .addColumn("key", text, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("revokedAt", timestamptz)
    .addPrimaryKeyConstraint("runner_access_key_pkey", ["id"])
    .addUniqueConstraint("runner_access_key_key_key", ["key"])
    .execute();

  await db.schema
    .createTable("server_setting")
    .ifNotExists()
    .addColumn("key", text, (c) => c.notNull())
    .addColumn("value", jsonb, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("server_setting_pkey", ["key"])
    .execute();

  await db.schema
    .createTable("session")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("expiresAt", timestamptz, (c) => c.notNull())
    .addColumn("token", text, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addColumn("ipAddress", text)
    .addColumn("userAgent", text)
    .addColumn("userId", text, (c) => c.notNull())
    .addColumn("impersonatedBy", text)
    .addColumn("activeOrganizationId", text)
    .addPrimaryKeyConstraint("session_pkey", ["id"])
    .addUniqueConstraint("session_token_key", ["token"])
    .execute();

  await db.schema
    .createTable("skill")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("codeDirectoryId", text)
    .addColumn("name", text, (c) => c.notNull())
    .addColumn("description", text, (c) => c.notNull())
    .addColumn("content", text, (c) => c.notNull())
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("skill_pkey", ["id"])
    .addUniqueConstraint("skill_scope_name_unique", ["organizationId", "codeDirectoryId", "name"], (c) => c.nullsNotDistinct())
    .execute();

  await db.schema
    .createTable("storage_backend")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("name", text, (c) => c.notNull())
    .addColumn("type", text, (c) => c.notNull())
    .addColumn("config", jsonb, (c) => c.defaultTo(sql`'{}'::jsonb`).notNull())
    .addColumn("enabled", boolean, (c) => c.defaultTo(true).notNull())
    .addColumn("createdAt", timestamp, (c) => c.notNull())
    .addColumn("updatedAt", timestamp, (c) => c.notNull())
    .addPrimaryKeyConstraint("storage_backend_pkey", ["id"])
    .addUniqueConstraint("storage_backend_name_key", ["name"])
    .execute();

  await db.schema
    .createTable("storage_bucket")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("backendId", text, (c) => c.notNull())
    .addColumn("name", text, (c) => c.notNull())
    .addColumn("type", text, (c) => c.defaultTo("default").notNull())
    .addColumn("isInternal", boolean, (c) => c.defaultTo(false).notNull())
    .addColumn("storageLimit", bigint)
    .addColumn("createdAt", timestamp, (c) => c.notNull())
    .addColumn("updatedAt", timestamp, (c) => c.notNull())
    .addPrimaryKeyConstraint("storage_bucket_pkey", ["id"])
    .addUniqueConstraint("storage_bucket_org_name_unique", ["organizationId", "name"])
    .execute();

  await db.schema
    .createTable("storage_entry")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("organizationId", text, (c) => c.notNull())
    .addColumn("bucketId", text, (c) => c.notNull())
    .addColumn("path", text, (c) => c.notNull())
    .addColumn("type", text, (c) => c.notNull())
    .addColumn("size", bigint, (c) => c.defaultTo(0).notNull())
    .addColumn("mimeType", text)
    .addColumn("previewType", text)
    .addColumn("createdAt", timestamp, (c) => c.notNull())
    .addColumn("updatedAt", timestamp, (c) => c.notNull())
    .addPrimaryKeyConstraint("storage_entry_pkey", ["id"])
    .addUniqueConstraint("storage_entry_bucket_path_unique", ["bucketId", "path"])
    .execute();

  await db.schema
    .createTable("user")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("name", text, (c) => c.notNull())
    .addColumn("email", text, (c) => c.notNull())
    .addColumn("emailVerified", boolean, (c) => c.notNull())
    .addColumn("image", text)
    .addColumn("role", text)
    .addColumn("banned", boolean, (c) => c.defaultTo(false))
    .addColumn("banReason", text)
    .addColumn("banExpires", timestamptz)
    .addColumn("createdAt", timestamptz, (c) => c.notNull())
    .addColumn("updatedAt", timestamptz, (c) => c.notNull())
    .addPrimaryKeyConstraint("user_pkey", ["id"])
    .addUniqueConstraint("user_email_key", ["email"])
    .execute();

  await db.schema
    .createTable("verification")
    .ifNotExists()
    .addColumn("id", text, (c) => c.notNull())
    .addColumn("identifier", text, (c) => c.notNull())
    .addColumn("value", text, (c) => c.notNull())
    .addColumn("expiresAt", timestamptz, (c) => c.notNull())
    .addColumn("createdAt", timestamptz)
    .addColumn("updatedAt", timestamptz)
    .addPrimaryKeyConstraint("verification_pkey", ["id"])
    .execute();

  const index = (name: string, table: string, columns: string[]) => db.schema.createIndex(name).ifNotExists().on(table).columns(columns).execute();

  await index("agent_organization_idx", "agent", ["organizationId"]);
  await index("api_key_org_idx", "api_key", ["organizationId"]);
  await index("code_directory_organization_idx", "code_directory", ["organizationId"]);
  await index("code_session_agent_idx", "code_session", ["agentId"]);
  await index("code_session_directory_idx", "code_session", ["codeDirectoryId"]);
  await index("code_session_message_session_idx", "code_session_message", ["sessionId"]);
  await index("code_session_organization_idx", "code_session", ["organizationId"]);
  await index("code_session_parent_idx", "code_session", ["parentSessionId"]);
  await index("code_session_usage_event_session_idx", "code_session_usage_event", ["sessionId"]);
  await index("device_user_idx", "device", ["userId"]);
  await index("instruction_organization_idx", "instruction", ["organizationId"]);
  await index("llm_connection_organization_idx", "llm_connection", ["organizationId"]);
  await index("llm_model_connection_idx", "llm_model", ["connectionId"]);
  await index("llm_usage_event_connection_idx", "llm_usage_event", ["connectionId"]);
  await index("memory_organization_idx", "memory", ["organizationId"]);
  await index("note_item_node_idx", "note_item", ["nodeId"]);
  await index("note_node_org_parent_idx", "note_node", ["organizationId", "parentId"]);
  await index("notification_org_idx", "notification", ["organizationId"]);
  await index("notification_user_idx", "notification", ["userId", "createdAt"]);
  await index("runner_organization_idx", "runner", ["organizationId"]);
  await index("storage_bucket_org_idx", "storage_bucket", ["organizationId", "backendId"]);
  await index("storage_entry_bucket_idx", "storage_entry", ["organizationId", "bucketId"]);

  const foreignKey = (table: string, name: string, columns: string[], refTable: string, onDelete?: "cascade" | "set null") =>
    db.schema
      .alterTable(table)
      .addForeignKeyConstraint(name, columns, refTable, ["id"], (c) => (onDelete ? c.onDelete(onDelete) : c))
      .execute();

  await foreignKey("account", "account_userId_fkey", ["userId"], "user", "cascade");
  await foreignKey("agent", "agent_codeDirectoryId_fkey", ["codeDirectoryId"], "code_directory", "cascade");
  await foreignKey("agent", "agent_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("api_key", "api_key_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("api_key", "api_key_userId_fkey", ["userId"], "user", "cascade");
  await foreignKey("code_directory", "code_directory_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("code_session", "code_session_agentId_fkey", ["agentId"], "agent", "set null");
  await foreignKey("code_session", "code_session_codeDirectoryId_fkey", ["codeDirectoryId"], "code_directory", "set null");
  await foreignKey("code_session_message", "code_session_message_sessionId_fkey", ["sessionId"], "code_session", "cascade");
  await foreignKey("code_session", "code_session_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("code_session", "code_session_parentSessionId_fkey", ["parentSessionId"], "code_session", "cascade");
  await foreignKey("code_session_usage_event", "code_session_usage_event_connectionId_fkey", ["connectionId"], "llm_connection", "cascade");
  await foreignKey("code_session_usage_event", "code_session_usage_event_sessionId_fkey", ["sessionId"], "code_session", "cascade");
  await foreignKey("device", "device_userId_fkey", ["userId"], "user", "cascade");
  await foreignKey("instruction", "instruction_codeDirectoryId_fkey", ["codeDirectoryId"], "code_directory", "cascade");
  await foreignKey("instruction", "instruction_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("invitation", "invitation_inviterId_fkey", ["inviterId"], "user");
  await foreignKey("invitation", "invitation_organizationId_fkey", ["organizationId"], "organization");
  await foreignKey("llm_connection", "llm_connection_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("llm_model", "llm_model_connectionId_fkey", ["connectionId"], "llm_connection", "cascade");
  await foreignKey("llm_model", "llm_model_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("llm_quota", "llm_quota_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("llm_quota", "llm_quota_connectionId_fkey", ["connectionId"], "llm_connection", "cascade");
  await foreignKey("llm_usage_event", "llm_usage_event_connectionId_fkey", ["connectionId"], "llm_connection", "cascade");
  await foreignKey("llm_usage_event", "llm_usage_event_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("member", "member_organizationId_fkey", ["organizationId"], "organization");
  await foreignKey("member", "member_userId_fkey", ["userId"], "user");
  await foreignKey("memory", "memory_codeDirectoryId_fkey", ["codeDirectoryId"], "code_directory", "cascade");
  await foreignKey("memory", "memory_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("note_item", "note_item_nodeId_fkey", ["nodeId"], "note_node", "cascade");
  await foreignKey("note_node", "note_node_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("note_node", "note_node_parentId_fkey", ["parentId"], "note_node", "cascade");
  await foreignKey("notification", "notification_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("notification", "notification_userId_fkey", ["userId"], "user", "cascade");
  await foreignKey("passkey", "passkey_userId_fkey", ["userId"], "user");
  await foreignKey("runner", "runner_accessKeyId_fkey", ["accessKeyId"], "runner_access_key");
  await foreignKey("runner_access_key", "runner_access_key_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("runner", "runner_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("session", "session_userId_fkey", ["userId"], "user", "cascade");
  await foreignKey("skill", "skill_codeDirectoryId_fkey", ["codeDirectoryId"], "code_directory", "cascade");
  await foreignKey("skill", "skill_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("storage_bucket", "storage_bucket_backendId_fkey", ["backendId"], "storage_backend", "cascade");
  await foreignKey("storage_bucket", "storage_bucket_organizationId_fkey", ["organizationId"], "organization", "cascade");
  await foreignKey("storage_entry", "storage_entry_bucketId_fkey", ["bucketId"], "storage_bucket", "cascade");

  // No-ops on fresh databases (the columns are in the CREATE TABLE above);
  // kept verbatim from the original migration.
  await sql`ALTER TABLE llm_model ADD COLUMN IF NOT EXISTS temperature boolean DEFAULT false NOT NULL`.execute(db);
  await sql`ALTER TABLE llm_model ADD COLUMN IF NOT EXISTS "limitContext" integer`.execute(db);
  await sql`ALTER TABLE llm_model ADD COLUMN IF NOT EXISTS "limitInput" integer`.execute(db);
  await sql`ALTER TABLE llm_model ADD COLUMN IF NOT EXISTS "limitOutput" integer`.execute(db);
  await sql`ALTER TABLE llm_model ADD COLUMN IF NOT EXISTS "costInput" double precision`.execute(db);
  await sql`ALTER TABLE llm_model ADD COLUMN IF NOT EXISTS "costOutput" double precision`.execute(db);
  await sql`ALTER TABLE llm_model ADD COLUMN IF NOT EXISTS "costCacheRead" double precision`.execute(db);
  await sql`ALTER TABLE llm_model ADD COLUMN IF NOT EXISTS output text[] DEFAULT '{}'::text[] NOT NULL`.execute(db);
}
