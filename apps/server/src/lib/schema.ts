import { sql, type Kysely } from "kysely";
import type { Database } from "../plugins/db";

// Final-state DDL, generated from the consolidated schema. Idempotent: every
// statement tolerates already-exists so the server can bootstrap a fresh
// database into the twodb schema on startup.

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS account (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS agent (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "codeDirectoryId" text,
    provider text NOT NULL,
    model text NOT NULL,
    description text,
    instruction text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS api_key (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    prefix text NOT NULL,
    hash text NOT NULL,
    "lastUsedAt" timestamp with time zone,
    "revokedAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS apikey (
    id text NOT NULL,
    "configId" text DEFAULT 'default'::text NOT NULL,
    name text,
    start text,
    "referenceId" text NOT NULL,
    prefix text,
    key text NOT NULL,
    "refillInterval" integer,
    "refillAmount" integer,
    "lastRefillAt" timestamp with time zone,
    enabled boolean DEFAULT true,
    "rateLimitEnabled" boolean DEFAULT true,
    "rateLimitTimeWindow" integer DEFAULT 86400000,
    "rateLimitMax" integer DEFAULT 10,
    "requestCount" integer DEFAULT 0,
    remaining integer,
    "lastRequest" timestamp with time zone,
    "expiresAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    permissions text,
    metadata text
);
CREATE TABLE IF NOT EXISTS assistant_artifact (
    id text NOT NULL,
    "threadId" text NOT NULL,
    "organizationId" text NOT NULL,
    title text NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS assistant_message (
    id text NOT NULL,
    "threadId" text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    meta jsonb,
    "createdAt" timestamp without time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS assistant_thread (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    title text NOT NULL,
    "connectionId" text,
    model text,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS code_directory (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "runnerId" text NOT NULL,
    cwd text NOT NULL,
    "displayName" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS code_session (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    title text NOT NULL,
    "connectionId" text,
    model text,
    "codeDirectoryId" text,
    type text DEFAULT 'main_agent'::text NOT NULL,
    "parentSessionId" text,
    "agentId" text,
    mode jsonb,
    "runtimeState" jsonb,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS code_session_message (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    meta jsonb,
    "createdAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS code_session_usage_event (
    id text NOT NULL,
    "sessionId" text NOT NULL,
    "connectionId" text NOT NULL,
    model text NOT NULL,
    "inputTokens" integer DEFAULT 0 NOT NULL,
    "outputTokens" integer DEFAULT 0 NOT NULL,
    "cachedInputTokens" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS device (
    id text NOT NULL,
    "userId" text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    platform text NOT NULL,
    token text NOT NULL,
    "lastSeenAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS instruction (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "codeDirectoryId" text,
    instruction text NOT NULL,
    "instructionPath" text NOT NULL,
    hash text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS invitation (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    email text NOT NULL,
    role text,
    status text DEFAULT 'pending'::text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "inviterId" text NOT NULL
);
CREATE TABLE IF NOT EXISTS kysely_migration (
    name character varying(255) NOT NULL,
    "timestamp" character varying(255) NOT NULL
);
CREATE TABLE IF NOT EXISTS kysely_migration_lock (
    id character varying(255) NOT NULL,
    is_locked integer DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS llm_connection (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    provider text NOT NULL,
    name text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS llm_model (
    id text NOT NULL,
    "connectionId" text NOT NULL,
    "organizationId" text NOT NULL,
    "modelId" text NOT NULL,
    "displayName" text,
    "contextWindow" integer,
    thinking boolean DEFAULT false NOT NULL,
    input text[] DEFAULT '{}'::text[] NOT NULL,
    "thinkingLevel" text[] DEFAULT '{}'::text[] NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS llm_usage_event (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "connectionId" text NOT NULL,
    "correlationId" text,
    model text NOT NULL,
    "inputTokens" integer DEFAULT 0 NOT NULL,
    "outputTokens" integer DEFAULT 0 NOT NULL,
    "cachedInputTokens" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS member (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "userId" text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS memory (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "codeDirectoryId" text,
    "scopeId" text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS note_item (
    id text NOT NULL,
    "nodeId" text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    preview text DEFAULT ''::text NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS note_node (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "parentId" text,
    kind text NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "isFavorite" boolean DEFAULT false NOT NULL,
    metadata jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS notification (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    data jsonb,
    "readAt" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS organization (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    "createdAt" timestamp with time zone NOT NULL,
    metadata text
);
CREATE TABLE IF NOT EXISTS passkey (
    id text NOT NULL,
    name text,
    "publicKey" text NOT NULL,
    "userId" text NOT NULL,
    "credentialID" text NOT NULL,
    counter integer NOT NULL,
    "deviceType" text NOT NULL,
    "backedUp" boolean NOT NULL,
    transports text,
    "createdAt" timestamp with time zone,
    aaguid text
);
CREATE TABLE IF NOT EXISTS runner (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "accessKeyId" text NOT NULL,
    name text NOT NULL,
    hostname text,
    "lastSeenAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "deletedAt" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS runner_access_key (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    name text NOT NULL,
    key text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "revokedAt" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS server_setting (
    key text NOT NULL,
    value jsonb NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS session (
    id text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL,
    "impersonatedBy" text,
    "activeOrganizationId" text
);
CREATE TABLE IF NOT EXISTS skill (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "codeDirectoryId" text,
    name text NOT NULL,
    description text NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS storage_backend (
    id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS storage_bucket (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "backendId" text NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'default'::text NOT NULL,
    "isInternal" boolean DEFAULT false NOT NULL,
    "storageLimit" bigint,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS storage_entry (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "bucketId" text NOT NULL,
    path text NOT NULL,
    type text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    "mimeType" text,
    "previewType" text,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS "user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    role text,
    banned boolean DEFAULT false,
    "banReason" text,
    "banExpires" timestamp with time zone,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE IF NOT EXISTS verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone
);
ALTER TABLE ONLY account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);
ALTER TABLE ONLY agent
    ADD CONSTRAINT agent_pkey PRIMARY KEY (id);
ALTER TABLE ONLY api_key
    ADD CONSTRAINT api_key_hash_key UNIQUE (hash);
ALTER TABLE ONLY api_key
    ADD CONSTRAINT api_key_pkey PRIMARY KEY (id);
ALTER TABLE ONLY apikey
    ADD CONSTRAINT apikey_pkey PRIMARY KEY (id);
ALTER TABLE ONLY assistant_artifact
    ADD CONSTRAINT assistant_artifact_pkey PRIMARY KEY (id);
ALTER TABLE ONLY assistant_artifact
    ADD CONSTRAINT assistant_artifact_unique_title UNIQUE ("threadId", title);
ALTER TABLE ONLY assistant_message
    ADD CONSTRAINT assistant_message_pkey PRIMARY KEY (id);
ALTER TABLE ONLY assistant_thread
    ADD CONSTRAINT assistant_thread_pkey PRIMARY KEY (id);
ALTER TABLE ONLY code_directory
    ADD CONSTRAINT code_directory_pkey PRIMARY KEY (id);
ALTER TABLE ONLY code_session_message
    ADD CONSTRAINT code_session_message_pkey PRIMARY KEY (id);
ALTER TABLE ONLY code_session
    ADD CONSTRAINT code_session_pkey PRIMARY KEY (id);
ALTER TABLE ONLY code_session_usage_event
    ADD CONSTRAINT code_session_usage_event_pkey PRIMARY KEY (id);
ALTER TABLE ONLY device
    ADD CONSTRAINT device_pkey PRIMARY KEY (id);
ALTER TABLE ONLY device
    ADD CONSTRAINT device_token_key UNIQUE (token);
ALTER TABLE ONLY instruction
    ADD CONSTRAINT instruction_pkey PRIMARY KEY (id);
ALTER TABLE ONLY instruction
    ADD CONSTRAINT instruction_scope_path_unique UNIQUE NULLS NOT DISTINCT ("organizationId", "codeDirectoryId", "instructionPath");
ALTER TABLE ONLY invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);
ALTER TABLE ONLY kysely_migration_lock
    ADD CONSTRAINT kysely_migration_lock_pkey PRIMARY KEY (id);
ALTER TABLE ONLY kysely_migration
    ADD CONSTRAINT kysely_migration_pkey PRIMARY KEY (name);
ALTER TABLE ONLY llm_connection
    ADD CONSTRAINT llm_connection_pkey PRIMARY KEY (id);
ALTER TABLE ONLY llm_model
    ADD CONSTRAINT llm_model_pkey PRIMARY KEY (id);
ALTER TABLE ONLY llm_usage_event
    ADD CONSTRAINT llm_usage_event_pkey PRIMARY KEY (id);
ALTER TABLE ONLY member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);
ALTER TABLE ONLY memory
    ADD CONSTRAINT memory_pkey PRIMARY KEY (id);
ALTER TABLE ONLY note_item
    ADD CONSTRAINT note_item_pkey PRIMARY KEY (id);
ALTER TABLE ONLY note_node
    ADD CONSTRAINT note_node_pkey PRIMARY KEY (id);
ALTER TABLE ONLY notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);
ALTER TABLE ONLY organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);
ALTER TABLE ONLY organization
    ADD CONSTRAINT organization_slug_key UNIQUE (slug);
ALTER TABLE ONLY passkey
    ADD CONSTRAINT passkey_pkey PRIMARY KEY (id);
ALTER TABLE ONLY runner_access_key
    ADD CONSTRAINT runner_access_key_key_key UNIQUE (key);
ALTER TABLE ONLY runner_access_key
    ADD CONSTRAINT runner_access_key_pkey PRIMARY KEY (id);
ALTER TABLE ONLY runner
    ADD CONSTRAINT runner_pkey PRIMARY KEY (id);
ALTER TABLE ONLY server_setting
    ADD CONSTRAINT server_setting_pkey PRIMARY KEY (key);
ALTER TABLE ONLY session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);
ALTER TABLE ONLY session
    ADD CONSTRAINT session_token_key UNIQUE (token);
ALTER TABLE ONLY skill
    ADD CONSTRAINT skill_pkey PRIMARY KEY (id);
ALTER TABLE ONLY skill
    ADD CONSTRAINT skill_scope_name_unique UNIQUE NULLS NOT DISTINCT ("organizationId", "codeDirectoryId", name);
ALTER TABLE ONLY storage_backend
    ADD CONSTRAINT storage_backend_name_key UNIQUE (name);
ALTER TABLE ONLY storage_backend
    ADD CONSTRAINT storage_backend_pkey PRIMARY KEY (id);
ALTER TABLE ONLY storage_bucket
    ADD CONSTRAINT storage_bucket_org_name_unique UNIQUE ("organizationId", name);
ALTER TABLE ONLY storage_bucket
    ADD CONSTRAINT storage_bucket_pkey PRIMARY KEY (id);
ALTER TABLE ONLY storage_entry
    ADD CONSTRAINT storage_entry_bucket_path_unique UNIQUE ("bucketId", path);
ALTER TABLE ONLY storage_entry
    ADD CONSTRAINT storage_entry_pkey PRIMARY KEY (id);
ALTER TABLE ONLY "user"
    ADD CONSTRAINT user_email_key UNIQUE (email);
ALTER TABLE ONLY "user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);
ALTER TABLE ONLY verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS agent_organization_idx ON agent USING btree ("organizationId");
CREATE INDEX IF NOT EXISTS api_key_org_idx ON api_key USING btree ("organizationId");
CREATE INDEX IF NOT EXISTS code_directory_organization_idx ON code_directory USING btree ("organizationId");
CREATE INDEX IF NOT EXISTS code_session_agent_idx ON code_session USING btree ("agentId");
CREATE INDEX IF NOT EXISTS code_session_directory_idx ON code_session USING btree ("codeDirectoryId");
CREATE INDEX IF NOT EXISTS code_session_message_session_idx ON code_session_message USING btree ("sessionId");
CREATE INDEX IF NOT EXISTS code_session_organization_idx ON code_session USING btree ("organizationId");
CREATE INDEX IF NOT EXISTS code_session_parent_idx ON code_session USING btree ("parentSessionId");
CREATE INDEX IF NOT EXISTS code_session_usage_event_session_idx ON code_session_usage_event USING btree ("sessionId");
CREATE INDEX IF NOT EXISTS device_user_idx ON device USING btree ("userId");
CREATE INDEX IF NOT EXISTS instruction_organization_idx ON instruction USING btree ("organizationId");
CREATE INDEX IF NOT EXISTS llm_connection_organization_idx ON llm_connection USING btree ("organizationId");
CREATE INDEX IF NOT EXISTS llm_model_connection_idx ON llm_model USING btree ("connectionId");
CREATE INDEX IF NOT EXISTS llm_usage_event_connection_idx ON llm_usage_event USING btree ("connectionId");
CREATE INDEX IF NOT EXISTS memory_organization_idx ON memory USING btree ("organizationId");
CREATE INDEX IF NOT EXISTS note_item_node_idx ON note_item USING btree ("nodeId");
CREATE INDEX IF NOT EXISTS note_node_org_parent_idx ON note_node USING btree ("organizationId", "parentId");
CREATE INDEX IF NOT EXISTS notification_org_idx ON notification USING btree ("organizationId");
CREATE INDEX IF NOT EXISTS notification_user_idx ON notification USING btree ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS runner_organization_idx ON runner USING btree ("organizationId");
CREATE INDEX IF NOT EXISTS storage_bucket_org_idx ON storage_bucket USING btree ("organizationId", "backendId");
CREATE INDEX IF NOT EXISTS storage_entry_bucket_idx ON storage_entry USING btree ("organizationId", "bucketId");
ALTER TABLE ONLY account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE;
ALTER TABLE ONLY agent
    ADD CONSTRAINT "agent_codeDirectoryId_fkey" FOREIGN KEY ("codeDirectoryId") REFERENCES code_directory(id) ON DELETE CASCADE;
ALTER TABLE ONLY agent
    ADD CONSTRAINT "agent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY api_key
    ADD CONSTRAINT "api_key_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY api_key
    ADD CONSTRAINT "api_key_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE;
ALTER TABLE ONLY code_directory
    ADD CONSTRAINT "code_directory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY code_session
    ADD CONSTRAINT "code_session_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES agent(id) ON DELETE SET NULL;
ALTER TABLE ONLY code_session
    ADD CONSTRAINT "code_session_codeDirectoryId_fkey" FOREIGN KEY ("codeDirectoryId") REFERENCES code_directory(id) ON DELETE SET NULL;
ALTER TABLE ONLY code_session_message
    ADD CONSTRAINT "code_session_message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES code_session(id) ON DELETE CASCADE;
ALTER TABLE ONLY code_session
    ADD CONSTRAINT "code_session_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY code_session
    ADD CONSTRAINT "code_session_parentSessionId_fkey" FOREIGN KEY ("parentSessionId") REFERENCES code_session(id) ON DELETE CASCADE;
ALTER TABLE ONLY code_session_usage_event
    ADD CONSTRAINT "code_session_usage_event_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES llm_connection(id) ON DELETE CASCADE;
ALTER TABLE ONLY code_session_usage_event
    ADD CONSTRAINT "code_session_usage_event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES code_session(id) ON DELETE CASCADE;
ALTER TABLE ONLY device
    ADD CONSTRAINT "device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE;
ALTER TABLE ONLY instruction
    ADD CONSTRAINT "instruction_codeDirectoryId_fkey" FOREIGN KEY ("codeDirectoryId") REFERENCES code_directory(id) ON DELETE CASCADE;
ALTER TABLE ONLY instruction
    ADD CONSTRAINT "instruction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY invitation
    ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"(id);
ALTER TABLE ONLY invitation
    ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id);
ALTER TABLE ONLY llm_connection
    ADD CONSTRAINT "llm_connection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY llm_model
    ADD CONSTRAINT "llm_model_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES llm_connection(id) ON DELETE CASCADE;
ALTER TABLE ONLY llm_model
    ADD CONSTRAINT "llm_model_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY llm_usage_event
    ADD CONSTRAINT "llm_usage_event_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES llm_connection(id) ON DELETE CASCADE;
ALTER TABLE ONLY llm_usage_event
    ADD CONSTRAINT "llm_usage_event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY member
    ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id);
ALTER TABLE ONLY member
    ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id);
ALTER TABLE ONLY memory
    ADD CONSTRAINT "memory_codeDirectoryId_fkey" FOREIGN KEY ("codeDirectoryId") REFERENCES code_directory(id) ON DELETE CASCADE;
ALTER TABLE ONLY memory
    ADD CONSTRAINT "memory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY note_item
    ADD CONSTRAINT "note_item_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES note_node(id) ON DELETE CASCADE;
ALTER TABLE ONLY note_node
    ADD CONSTRAINT "note_node_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY note_node
    ADD CONSTRAINT "note_node_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES note_node(id) ON DELETE CASCADE;
ALTER TABLE ONLY notification
    ADD CONSTRAINT "notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY notification
    ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE;
ALTER TABLE ONLY passkey
    ADD CONSTRAINT "passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id);
ALTER TABLE ONLY runner
    ADD CONSTRAINT "runner_accessKeyId_fkey" FOREIGN KEY ("accessKeyId") REFERENCES runner_access_key(id);
ALTER TABLE ONLY runner_access_key
    ADD CONSTRAINT "runner_access_key_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY runner
    ADD CONSTRAINT "runner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE;
ALTER TABLE ONLY skill
    ADD CONSTRAINT "skill_codeDirectoryId_fkey" FOREIGN KEY ("codeDirectoryId") REFERENCES code_directory(id) ON DELETE CASCADE;
ALTER TABLE ONLY skill
    ADD CONSTRAINT "skill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY storage_bucket
    ADD CONSTRAINT "storage_bucket_backendId_fkey" FOREIGN KEY ("backendId") REFERENCES storage_backend(id) ON DELETE CASCADE;
ALTER TABLE ONLY storage_bucket
    ADD CONSTRAINT "storage_bucket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE;
ALTER TABLE ONLY storage_entry
    ADD CONSTRAINT "storage_entry_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES storage_bucket(id) ON DELETE CASCADE;
`;

const TOLERATED_CODES = new Set(["42P06", "42P07", "42P16", "42701", "42710"]);

export async function ensureSchema(db: Kysely<Database>): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS twodb`.execute(db);
  for (const statement of SCHEMA_SQL.split(";\n").map((s) => s.trim()).filter(Boolean)) {
    try {
      await sql.raw(statement).execute(db);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (!TOLERATED_CODES.has(code ?? "")) throw e;
    }
  }
}
