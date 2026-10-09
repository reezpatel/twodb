import { type ColumnType, Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

export interface UserTable {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
}

export interface SessionTable {
  id: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string;
  impersonatedBy: string | null;
  activeOrganizationId: string | null;
}

export interface AccountTable {
  id: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  password: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationTable {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface OrganizationTable {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
  metadata: string | null;
}

export interface MemberTable {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

export interface InvitationTable {
  id: string;
  organizationId: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  inviterId: string;
}

export interface PasskeyTable {
  id: string;
  name: string | null;
  publicKey: string;
  userId: string;
  credentialID: string;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports: string | null;
  createdAt: Date | null;
  aaguid: string | null;
}

export interface ApiKeyTable {
  id: string;
  configId: string;
  name: string | null;
  start: string | null;
  referenceId: string;
  prefix: string | null;
  key: string;
  refillInterval: number | null;
  refillAmount: number | null;
  lastRefillAt: Date | null;
  enabled: boolean | null;
  rateLimitEnabled: boolean | null;
  rateLimitTimeWindow: number | null;
  rateLimitMax: number | null;
  requestCount: number | null;
  remaining: number | null;
  lastRequest: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  permissions: string | null;
  metadata: string | null;
}

export interface LlmConnectionTable {
  id: string;
  organizationId: string;
  provider: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RunnerAccessKeyTable {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface RunnerTable {
  id: string;
  organizationId: string;
  accessKeyId: string;
  name: string;
  hostname: string | null;
  lastSeenAt: Date;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CodeDirectoryTable {
  id: string;
  organizationId: string;
  runnerId: string;
  cwd: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CodeSessionType = "main_agent" | "sub_agent" | "chat";

export interface CodeSessionMode {
  type: string;
  instruction: string;
  commands: string[];
}

export interface CodeSessionTable {
  id: string;
  organizationId: string;
  title: string;
  connectionId: string | null;
  model: string | null;
  codeDirectoryId: string | null;
  /** Skills tagged "default" or any of these load into the system prompt. */
  tags: string[];
  type: CodeSessionType;
  parentSessionId: string | null;
  agentId: string | null;
  mode: ColumnType<CodeSessionMode | null, string | null, string | null>;
  /** off | low | medium | high — null means medium. */
  thinkingLevel: string | null;
  runtimeState: ColumnType<Record<string, unknown> | null, string | null, string | null>;
  /** get_plan/update_plan state — { steps: [{ description, status }] }. */
  plan: ColumnType<Record<string, unknown> | null, string | null, string | null>;
  /** True → read-only thread (closed /btw side thread). */
  locked: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  /** True → the agent may ask the user (ask_user) and be steered mid-run; false → headless. */
  interactive: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  /** Invocation depth — main sessions 0; children parent + 1. invoke_subagent caps at 3. */
  depthCount: ColumnType<number, number | undefined, number | undefined>;
  /** Run finished since the user last opened this session — sidebar unread marker. */
  unseenUpdates: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  /** Set for chat sessions — binds the per-(channel × agent) session to its channel. */
  chatChannelId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeCheckpointTable {
  id: string;
  organizationId: string;
  sessionId: string;
  codeDirectoryId: string;
  label: string | null;
  ref: string;
  commitSha: string;
  /** manual | auto_pre_round */
  trigger: string;
  createdAt: Date;
}

export interface SkillTable {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  name: string;
  description: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type AgentType = "sub_agent" | "persona" | "collaborator" | "sentinel";

export interface AgentTable {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  provider: string;
  model: string;
  description: string | null;
  instruction: string;
  tags: string[];
  /** sub_agent | persona | collaborator | sentinel. */
  type: AgentType;
  /** Tool allowlist — ["all"] = every tool (incl. future ones); [] = no tools. Stored jsonb — insert a JSON string. */
  tools: ColumnType<string[], string, string>;
  /** Display name for chat (fallback: description). */
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface McpServerTable {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  /** Unique per scope; tools are namespaced with it (mcp__<name>__<tool>). */
  name: string;
  url: string;
  /** auto (streamable http, sse fallback) | http | sse. */
  transport: string;
  /** Static auth headers — "Authorization": "Bearer <KEY>" placeholders resolved at connect time. */
  headers: Record<string, string>;
  enabled: boolean;
  /** "default" tag or any session tag enables the server for that session. */
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InstructionTable {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  instruction: string;
  instructionPath: string | null;
  hash: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type MemoryScope = "workspace" | "project" | "session";

export interface MemoryTable {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  scopeId: string | null;
  /** workspace | project | session */
  scope: MemoryScope;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LlmTagTable {
  id: string;
  organizationId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeSessionMessageTable {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

export interface LlmQuotaTable {
  id: string;
  organizationId: string;
  connectionId: string;
  quotaType: string;
  groupName: string;
  unit: string;
  quotaTotal: number | null;
  quotaUsed: number;
  capturedAt: Date;
  resetAt: Date | null;
}

export interface LlmUsageEventTable {
  id: string;
  organizationId: string;
  connectionId: string;
  correlationId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  createdAt: Date;
}

export interface FooterPreferenceTable {
  id: string;
  organizationId: string;
  userId: string;
  key: string;
  value: ColumnType<Record<string, unknown>, string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeSessionUsageEventTable {
  id: string;
  sessionId: string;
  connectionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  createdAt: Date;
}

export interface LlmModelTable {
  id: string;
  connectionId: string;
  organizationId: string;
  modelId: string;
  displayName: string | null;
  contextWindow: number | null;
  thinking: boolean;
  input: ("text" | "image" | "video")[];
  thinkingLevel: string[];
  temperature: boolean;
  limitContext: number | null;
  limitInput: number | null;
  limitOutput: number | null;
  costInput: number | null;
  costOutput: number | null;
  costCacheRead: number | null;
  output: string[];
  createdAt: Date;
}

export interface StorageBackendTable {
  id: string;
  name: string;
  type: "object" | "block";
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageBucketTable {
  id: string;
  organizationId: string;
  backendId: string;
  name: string;
  type: string;
  isInternal: boolean;
  storageLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageEntryTable {
  id: string;
  organizationId: string;
  bucketId: string;
  path: string;
  type: "file" | "folder";
  size: number;
  mimeType: string | null;
  previewType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantThreadTable {
  id: string;
  organizationId: string;
  title: string;
  connectionId: string | null;
  model: string | null;
  /** Bound agent persona — its system prompt applies to this thread. */
  agentId: string | null;
  /** Tags joined into skill/instruction matching. */
  tags: string[];
  /** off | low | medium | high — null means medium. */
  thinkingLevel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantMessageTable {
  id: string;
  threadId: string;
  role: string;
  content: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
}

export type CodeSessionArtifactType = "markdown" | "html" | "code" | "text";

export interface MediaAssetTable {
  id: string;
  organizationId: string;
  sessionId: string | null;
  /** Chat channel this attachment belongs to — powers the Files tab. */
  chatChannelId: string | null;
  backendId: string;
  /** Full object path inside the backend, including the destination prefix. */
  path: string;
  filename: string;
  extension: string;
  contentType: string | null;
  size: number;
  createdAt: Date;
}

export interface CodeSessionArtifactTable {
  id: string;
  sessionId: string;
  organizationId: string;
  title: string;
  type: CodeSessionArtifactType;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NoteKind = "section" | "folder" | "notes" | "checklist" | "table" | "sheet" | "canvas";

export type NoteGroupType = "notes" | "checklist" | "table" | "sheet" | "canvas";

export type NotePropertyType =
  "text" | "number" | "select" | "multiselect" | "status" | "date" | "person" | "files & media" | "checkbox" | "url" | "phone" | "email" | "id" | "place";

export interface NotePropertyOption {
  id: string;
  value: string;
  label?: string;
  color?: string;
  /** Group label (e.g. "Backlog", "Active", "Done") for status columns. */
  group?: string;
}

export interface NotePropertyDef {
  id: string;
  name: string;
  type: NotePropertyType;
  options?: NotePropertyOption[];
  validation?: { required?: boolean } & Record<string, unknown>;
}

export type NoteViewType = "table" | "list" | "kanban";

export interface NoteViewDef {
  id: string;
  name: string;
  type: NoteViewType;
  groupBy?: string | null;
  sorts?: { property: string; direction: "asc" | "desc" }[];
  /** Persisted column widths, keyed by column id. Restored after refresh. */
  widths?: Record<string, number>;
}

export interface NoteGroupMetadata {
  columns: NotePropertyDef[];
  views: NoteViewDef[];
}

export interface NoteNodeTable {
  id: string;
  organizationId: string;
  parentId: string | null;
  kind: NoteKind;
  name: string;
  position: number;
  isFavorite: boolean;
  metadata: NoteGroupMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteItemTable {
  id: string;
  nodeId: string;
  title: string;
  content: Record<string, unknown>;
  preview: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgApiKeyTable {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  prefix: string;
  hash: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerSettingTable {
  key: string;
  value: Record<string, unknown>;
  updatedAt: Date;
}

export interface DeviceTable {
  id: string;
  userId: string;
  name: string;
  platform: string;
  token: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTable {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface ChatChannelTable {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  parentId: string | null;
  /** channel | assistant (assistant = per-user sentinel DM). */
  kind: string;
  name: string;
  description: string | null;
  position: number;
  createdById: string | null;
  lastMessageAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatChannelMemberTable {
  id: string;
  organizationId: string;
  channelId: string;
  /** user | agent. */
  memberType: string;
  userId: string | null;
  agentId: string | null;
  createdAt: Date;
}

export interface ChatMessageTable {
  id: string;
  organizationId: string;
  channelId: string;
  /** user | agent. */
  authorType: string;
  userId: string | null;
  agentId: string | null;
  body: string;
  /** { mentions?, attachments?, linkCard?, sessionRef? }. */
  meta: Record<string, unknown> | null;
  /** Single-level reply — server clamps to root messages. */
  replyToId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface ChatReactionTable {
  id: string;
  organizationId: string;
  messageId: string;
  authorType: string;
  userId: string | null;
  emoji: string;
  createdAt: Date;
}

export interface ChatPinTable {
  id: string;
  organizationId: string;
  channelId: string;
  messageId: string;
  createdById: string;
  createdAt: Date;
}

export interface ChatSavedTable {
  id: string;
  organizationId: string;
  messageId: string;
  userId: string;
  createdAt: Date;
}

export interface ChatDraftTable {
  id: string;
  organizationId: string;
  channelId: string;
  userId: string;
  body: string;
  updatedAt: Date;
}

export interface ChatReadStateTable {
  id: string;
  organizationId: string;
  channelId: string;
  userId: string;
  lastReadMessageId: string | null;
  updatedAt: Date;
}

export interface Database {
  user: UserTable;
  session: SessionTable;
  account: AccountTable;
  verification: VerificationTable;
  organization: OrganizationTable;
  member: MemberTable;
  invitation: InvitationTable;
  passkey: PasskeyTable;
  apikey: ApiKeyTable;
  llm_connection: LlmConnectionTable;
  runner_access_key: RunnerAccessKeyTable;
  runner: RunnerTable;
  code_directory: CodeDirectoryTable;
  code_session: CodeSessionTable;
  code_session_message: CodeSessionMessageTable;
  code_session_usage_event: CodeSessionUsageEventTable;
  code_checkpoint: CodeCheckpointTable;
  skill: SkillTable;
  agent: AgentTable;
  mcp_server: McpServerTable;
  instruction: InstructionTable;
  memory: MemoryTable;
  llm_tag: LlmTagTable;
  llm_quota: LlmQuotaTable;
  llm_usage_event: LlmUsageEventTable;
  footer_preference: FooterPreferenceTable;
  llm_model: LlmModelTable;
  storage_backend: StorageBackendTable;
  storage_bucket: StorageBucketTable;
  storage_entry: StorageEntryTable;
  code_session_artifact: CodeSessionArtifactTable;
  media_asset: MediaAssetTable;
  chat_channel: ChatChannelTable;
  chat_channel_member: ChatChannelMemberTable;
  chat_message: ChatMessageTable;
  chat_reaction: ChatReactionTable;
  chat_pin: ChatPinTable;
  chat_saved: ChatSavedTable;
  chat_draft: ChatDraftTable;
  chat_read_state: ChatReadStateTable;
  note_node: NoteNodeTable;
  note_item: NoteItemTable;
  server_setting: ServerSettingTable;
  api_key: OrgApiKeyTable;
  device: DeviceTable;
  notification: NotificationTable;
}

export const dbSchema = process.env.TWODB_DB_SCHEMA ?? "twodb";

export function createDb(connectionString: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      // All unqualified names — including the dynamic notes tables — resolve
      // into the twodb schema; public stays on the path for extensions.
      pool: new Pool({ connectionString, options: `-c search_path=${dbSchema},public` }),
    }),
  });
}
