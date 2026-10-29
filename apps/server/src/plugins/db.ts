import { type ColumnType, type Generated, Kysely, PostgresDialect, type Selectable, type Updateable } from "kysely";
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
  /** Space this resource belongs to; null = all spaces. */
  spaceId: string | null;
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
  /** Mount points to report in metrics — configured in Settings → Runners. */
  diskPaths: ColumnType<string[] | null, string | null | undefined, string | null | undefined>;
  /** AWS SSO start-app URL (one per runner) — the AWS widget's device-code login uses it. */
  awsStartUrl: ColumnType<string | null, string | null | undefined, string | null | undefined>;
  awsSsoRegion: ColumnType<string | null, string | null | undefined, string | null | undefined>;
  lastSeenAt: Date;
  createdAt: Date;
  deletedAt: Date | null;
}

/** One Teams account (company) watched by a runner-side Chromium session. */
export interface TeamsAccountTable {
  id: string;
  organizationId: string;
  /** Owner — this account's Teams events become notifications for this user. */
  userId: string;
  /** Runner hosting the Chromium session for this account. */
  runnerId: string;
  label: string;
  /** Login hint shown on the connect screen (UPN/email). */
  email: string | null;
  enabled: boolean;
  /** idle | starting | running | auth_required | error | runner_offline */
  status: string;
  lastError: string | null;
  lastEventAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** One persisted metrics sample per runner per 10-minute window; jsonb payload mirrors the runner's RunnerMetrics minus `at`. */
export interface RunnerMetricTable {
  id: string;
  runnerId: string;
  organizationId: string;
  at: Date;
  /** jsonb columns bind as strings; pg parses them back to objects on read. */
  cpu: ColumnType<{ busy: number; load1: number; cores: number; perCore: number[] }, string, string>;
  memory: ColumnType<{ used: number; total: number }, string, string>;
  gpus: ColumnType<{ vendor: string; index: number; name: string; utilization: number; memoryUsed: number; memoryTotal: number; temperature: number | null }[], string, string>;
  disks: ColumnType<{ path: string; used: number; total: number; inodeUsedRatio: number | null; error?: string }[], string, string>;
}

export interface CodeDirectoryTable {
  id: string;
  organizationId: string;
  runnerId: string;
  cwd: string;
  displayName: string;
  /** Space this directory belongs to; sessions in it see matching-space resources. */
  spaceId: string | null;
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
  /** null = active; set = archived (hidden unless archive mode is on). */
  archivedAt: ColumnType<Date, Date | null, Date | null>;
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
  /** Space this skill belongs to; null = all spaces. */
  spaceId: string | null;
  name: string;
  description: string;
  content: string;
  tags: string[];
  /** false → hidden from the AI (not listed, not readable via read_skill); user-only via /name. */
  aiVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentType = "sub_agent" | "persona" | "collaborator" | "sentinel";

export interface AgentTable {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  /** Space this agent belongs to; null = all spaces. */
  spaceId: string | null;
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
  /** Persona only: directory its sessions run in; null = inherit the invoking session's. */
  workDirectoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface McpServerTable {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  /** Space this server belongs to; null = all spaces. */
  spaceId: string | null;
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
  /** Space this instruction belongs to; null = all spaces. */
  spaceId: string | null;
  instruction: string;
  instructionPath: string | null;
  hash: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Memory levels: organization-wide, one code directory, one agent's own ("self"), or a single session (legacy). */
export type MemoryScope = "organization" | "code_directory" | "agent" | "session";

export interface MemoryTable {
  id: string;
  organizationId: string;
  codeDirectoryId: string | null;
  /** Space this memory belongs to; null = all spaces. */
  spaceId: string | null;
  scopeId: string | null;
  /** organization | code_directory | agent | session */
  scope: MemoryScope;
  /** Agent that owns the memory when scope = agent (persona / collaborator / sentinel). */
  agentId: string | null;
  /** Shown by default and used as the key by the memory tools; unique per level. */
  title: string;
  /** Read on demand (read_memory / click in the UI). */
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


export type ProjectExternalSource = "linear" | "plane";
export type ProjectRole = "owner" | "admin" | "member";
export type StatusCategory = "backlog" | "todo" | "in_progress" | "done" | "canceled";
export type TicketType = "issue" | "epic" | "bug" | "task" | "feature" | "chore";
export type TicketPriority = "none" | "low" | "medium" | "high" | "urgent";
export type SprintStatus = "planned" | "active" | "closed";

export interface ProjectTable {
  id: string;
  organizationId: string;
  spaceId: string | null;
  name: string;
  /** Uppercase identifier key ("PRO"); unique per org. */
  key: string;
  description: string;
  icon: string | null;
  color: string | null;
  nextTicketNumber: number;
  externalSource: ProjectExternalSource | null;
  externalRef: Record<string, unknown> | null;
  syncFilter: Record<string, unknown> | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMemberTable {
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: Date;
}

export interface SubprojectTable {
  id: string;
  projectId: string;
  name: string;
  description: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectStatusTable {
  id: string;
  projectId: string;
  /** null = project-level set; set = subproject override set. */
  subprojectId: string | null;
  name: string;
  color: string;
  category: StatusCategory;
  position: number;
  /** "sync" = locked, copied from Linear/Plane. */
  editable: "yes" | "sync";
  createdAt: Date;
}

export interface LabelGroupTable {
  id: string;
  projectId: string;
  name: string;
  position: number;
}

export interface LabelTable {
  id: string;
  projectId: string;
  groupId: string | null;
  name: string;
  color: string;
  editable: "yes" | "sync";
  externalRef: Record<string, unknown> | null;
}

export interface ProjectTagTable {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface MilestoneTable {
  id: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: string | null;
  status: "open" | "closed";
  position: number;
  createdAt: Date;
}

export interface SprintTable {
  id: string;
  projectId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
  completedPoints: number | null;
  createdAt: Date;
}

export interface ProjectLinkTable {
  projectId: string;
  linkedProjectId: string;
  createdAt: Date;
}

export interface TicketTable {
  id: string;
  organizationId: string;
  projectId: string;
  subprojectId: string;
  number: number;
  title: string;
  description: string;
  type: TicketType;
  statusId: string;
  priority: TicketPriority;
  estimate: number | null;
  parentTicketId: string | null;
  epicId: string | null;
  sprintId: string | null;
  milestoneId: string | null;
  assigneeUserId: string | null;
  inBacklog: boolean;
  position: number;
  externalRef: Record<string, unknown> | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketDependencyTable {
  ticketId: string;
  dependsOnTicketId: string;
  createdAt: Date;
}

export interface TicketLabelTable {
  ticketId: string;
  labelId: string;
}

export interface TicketTagTable {
  ticketId: string;
  tagId: string;
}

export interface TicketCommentTable {
  id: string;
  ticketId: string;
  userId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketChecklistItemTable {
  id: string;
  ticketId: string;
  parentItemId: string | null;
  text: string;
  done: boolean;
  position: number;
  createdAt: Date;
}

export type CodeSessionJobStatus = "running" | "done" | "failed" | "killed" | "lost";

export interface CodeSessionJobTable {
  id: string;
  sessionId: string;
  organizationId: string;
  runnerId: string;
  command: string;
  cwd: string | null;
  /** running | done | failed | killed | lost */
  status: CodeSessionJobStatus;
  exitCode: number | null;
  /** Absolute path of the job's combined-output log on the runner. */
  logPath: string;
  createdAt: Date;
  finishedAt: Date | null;
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

export interface SpaceTable {
  id: string;
  organizationId: string;
  name: string;
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
  /** Content hash — email attachments dedupe identical bytes. */
  sha256: ColumnType<string | null, string | null | undefined, string | null>;
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

/** Notion-style notes: everything is a node. Database rows are `page` nodes
 *  whose parent is a `database`. */
export type NoteKind = "section" | "page" | "database";

export type NotePropertyType =
  "text" | "number" | "select" | "multiselect" | "status" | "date" | "person" | "files & media" | "media" | "checkbox" | "url" | "phone" | "email" | "id" | "place";

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

/** Database schema — property definitions + saved views. */
export interface NoteDatabaseSchema {
  columns: NotePropertyDef[];
  views: NoteViewDef[];
}

export interface NoteNodeTable {
  id: string;
  organizationId: string;
  /** null only for sections. */
  parentId: string | null;
  kind: NoteKind;
  title: Generated<string>;
  /** twodb:// uri or emoji. */
  icon: ColumnType<string | null, string | null | undefined, string | null>;
  cover: ColumnType<string | null, string | null | undefined, string | null>;
  /** Pages: tiptap doc JSON. */
  content: ColumnType<Record<string, unknown> | null, Record<string, unknown> | null | undefined, Record<string, unknown> | null>;
  preview: Generated<string>;
  /** Databases only. */
  schema: ColumnType<NoteDatabaseSchema | null, NoteDatabaseSchema | null | undefined, NoteDatabaseSchema | null>;
  /** Databases only: owning app/feature (e.g. "twodb:shared_content"). When
   *  set, the schema (property definitions) is locked — users can still edit
   *  rows, views, title and placement. */
  schemaLockedBy: ColumnType<string | null, string | null | undefined, string | null>;
  /** Database embedded as a block in its parent page's content. */
  inline: Generated<boolean>;
  position: Generated<number>;
  isFavorite: Generated<boolean>;
  deletedAt: ColumnType<Date | null, Date | null | undefined, Date | null>;
  createdAt: Date;
  updatedAt: Date;
}

export type NoteNode = Selectable<NoteNodeTable>;
export type NoteNodeUpdate = Updateable<NoteNodeTable>;

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
  /** "core" | app id. */
  origin: string;
  /** dotted type, e.g. "calendar.reminder". */
  type: string;
  urgency: string;
  icon: string | null;
  accent: string | null;
  audience: string | null;
  actorName: string | null;
  actorImage: string | null;
  media: Record<string, unknown>[] | null;
  actions: Record<string, unknown>[] | null;
  deepLink: string | null;
  groupingKey: string | null;
  dedupeKey: string | null;
  silent: boolean;
  revision: number;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  expiresAt: Date | null;
}

export interface NotificationRecipientTable {
  id: string;
  notificationId: string;
  organizationId: string;
  userId: string;
  seenAt: Date | null;
  readAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
}

export interface NotificationPreferenceTable {
  id: string;
  organizationId: string;
  userId: string;
  /** "core" | app id — the coarse group. */
  groupId: string;
  /** dotted type id; null = group-level default row. */
  typeId: string | null;
  /** { inApp, toast, osPush, emailDigest } tri-state (null = inherit). */
  channels: Record<string, unknown>;
  urgencyFloor: string | null;
  createdAt: Date;
  updatedAt: Date;
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

export interface MeetingRecordingTable {
  id: string;
  organizationId: string;
  platform: string;
  title: string | null;
  meetingUrl: string | null;
  clientSessionId: string | null;
  status: "recording" | "finalized" | "abandoned";
  startedAt: Date;
  endedAt: Date | null;
  lastHeartbeatAt: Date | null;
}

export interface MeetingRecordingTrackTable {
  id: string;
  recordingId: string;
  organizationId: string;
  trackId: string;
  nextSeq: number;
  receivedChunks: number;
  receivedBytes: number;
  durationMs: number | null;
  trackStartedAt: Date | null;
  mediaAssetId: string | null;
  createdAt: Date;
}

/** jsonb column written as a JSON string (pg would serialize JS arrays as postgres arrays). */
type Json<T> = ColumnType<T, string, string>;

export interface EmailAddress {
  name: string | null;
  address: string;
}

export interface ConnectedAccountTable {
  id: string;
  organizationId: string;
  ownerUserId: string;
  /** private | shared. */
  visibility: Generated<string>;
  /** google | microsoft | imap (imap covers IMAP/SMTP + CalDAV presets). */
  kind: string;
  /** google | microsoft | icloud | fastmail | yahoo | nextcloud | custom. */
  preset: string | null;
  address: string;
  displayName: string | null;
  aliases: Json<string[]>;
  /** Non-secret connector config (hosts, ports, tls, appendToSent). */
  config: Json<Record<string, unknown>>;
  /** AES-256-GCM sealed JSON (lib/email/crypto). */
  credentials: string | null;
  /** Head cursor — gmail {historyId}; imap {[mailbox]: {uidValidity, lastUid}}. */
  syncCursor: Json<Record<string, unknown>>;
  /** Tail cursor for the full backfill; null once done. */
  backfillCursor: Json<Record<string, unknown> | null>;
  /** pending | running | paused | done | error. */
  backfillState: Generated<string>;
  backfillProgress: Json<Record<string, unknown>>;
  /** active | error | reauth_required | paused. */
  status: Generated<string>;
  lastError: string | null;
  lastSyncedAt: Date | null;
  nextSyncAt: Date | null;
  syncIntervalSec: Generated<number>;
  signatureHtml: string | null;
  color: string | null;
  position: Generated<number>;
  /** mail | calendar. */
  capabilities: ColumnType<string[], string[] | undefined, string[]>;
  grantedScopes: ColumnType<string[], string[] | undefined, string[]>;
  /** disabled | active | paused | error | reauth_required. */
  calendarState: Generated<string>;
  calendarError: string | null;
  /** pending | running | done | error. */
  calendarImportState: Generated<string>;
  calendarImportProgress: ColumnType<Record<string, unknown>, string | undefined, string>;
  calendarImportFrom: ColumnType<Date | null, string | null | undefined, string | null>;
  calendarListSyncedAt: Date | null;
  calendarLastSyncedAt: Date | null;
  calendarNextSyncAt: Date | null;
  /** polling | webhooks. */
  syncMode: Generated<string>;
  suggestOrgMembers: Generated<boolean>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ConnectedAccountMemberTable {
  id: string;
  organizationId: string;
  accountId: string;
  userId: string;
  /** owner | member | viewer. */
  role: string;
  createdAt: Date;
}

export interface EmailThreadTable {
  id: string;
  organizationId: string;
  accountId: string;
  providerThreadId: string | null;
  subject: string;
  /** inbox | archive | spam — local placement only. */
  location: string;
  isPinned: Generated<boolean>;
  snoozedUntil: Date | null;
  mutedAt: Date | null;
  lastMessageAt: Date;
  lastInboundAt: Date | null;
  messageCount: Generated<number>;
  unreadCount: Generated<number>;
  hasAttachments: Generated<boolean>;
  hasStarred: Generated<boolean>;
  hasDraft: Generated<boolean>;
  hasSent: Generated<boolean>;
  hasOutbox: Generated<boolean>;
  hasScheduled: Generated<boolean>;
  hasDeletedMessages: Generated<boolean>;
  participants: Json<EmailAddress[]>;
  snippet: string | null;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  purgedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailMessageTable {
  id: string;
  organizationId: string;
  accountId: string;
  threadId: string;
  /** inbound | outbound. */
  direction: string;
  /** received | draft | scheduled | queued | sending | sent | failed | cancelled. */
  status: string;
  /** new | reply | reply_all | forward. */
  composeKind: string | null;
  sourceMessageId: string | null;
  providerMessageId: string | null;
  providerThreadId: string | null;
  rfcMessageId: string | null;
  inReplyTo: string | null;
  references: ColumnType<string[], string[] | undefined, string[]>;
  fromAddress: string | null;
  fromName: string | null;
  to: Json<EmailAddress[]>;
  cc: Json<EmailAddress[]>;
  bcc: Json<EmailAddress[]>;
  replyTo: Json<EmailAddress[]>;
  subject: string;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  headers: Json<Record<string, string>>;
  rawMediaId: string | null;
  sentAt: Date | null;
  receivedAt: Date | null;
  scheduledAt: Date | null;
  sendAfter: Date | null;
  attempts: Generated<number>;
  nextAttemptAt: Date | null;
  lastError: string | null;
  isRead: Generated<boolean>;
  isStarred: Generated<boolean>;
  sentByUserId: string | null;
  searchVector: ColumnType<string, never, never>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedByUserId: string | null;
  purgedAt: Date | null;
}

export interface EmailAttachmentTable {
  id: string;
  organizationId: string;
  messageId: string;
  mediaId: string | null;
  filename: string;
  contentType: string | null;
  size: number;
  contentId: string | null;
  isInline: Generated<boolean>;
  /** stored | pending | skipped | failed. */
  status: string;
  createdAt: Date;
}

export interface EmailLabelTable {
  id: string;
  organizationId: string;
  ownerUserId: string;
  /** null = personal label usable across accounts; set = shared-account label. */
  accountId: string | null;
  parentId: string | null;
  /** Materialized ancestor chain of ids, "rootId/childId/…/id". */
  path: string;
  depth: number;
  name: string;
  /** null = inherit from parent. */
  color: string | null;
  position: Generated<number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailThreadLabelTable {
  threadId: string;
  labelId: string;
  addedByUserId: string | null;
  createdAt: Date;
}

export interface EmailSenderRuleTable {
  id: string;
  organizationId: string;
  ownerUserId: string;
  accountId: string | null;
  /** address | domain. */
  matchType: string;
  value: string;
  /** spam. */
  action: string;
  createdAt: Date;
}

export interface ConnectedAccountWebhookTable {
  id: string;
  organizationId: string;
  accountId: string;
  calendarId: string | null;
  /** google | microsoft. */
  provider: string;
  channelId: string;
  resourceId: string | null;
  secretHash: string;
  expiresAt: Date;
  lastNotifiedAt: Date | null;
  createdAt: Date;
}

export interface ContactBookTable {
  id: string;
  organizationId: string;
  /** account | local. */
  kind: string;
  accountId: string | null;
  ownerUserId: string;
  /** pending | running | done — one-time learning pass over stored mail. */
  learnState: Generated<string>;
  learnProgress: ColumnType<Record<string, unknown>, string | undefined, string>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ContactTable {
  id: string;
  organizationId: string;
  bookId: string;
  email: string;
  name: string | null;
  /** email | calendar | imip | manual — manual is never overwritten by learning. */
  nameSource: Generated<string>;
  /** person | resource | list | group_address. */
  kind: Generated<string>;
  domain: ColumnType<string, never, never>;
  notes: string | null;
  userId: string | null;
  sentCount: Generated<number>;
  receivedCount: Generated<number>;
  repliedCount: Generated<number>;
  meetingCount: Generated<number>;
  organizedByMeCount: Generated<number>;
  organizedByThemCount: Generated<number>;
  score: Generated<number>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastEmailAt: Date | null;
  lastMeetingAt: Date | null;
  nextMeetingAt: Date | null;
  pinned: Generated<boolean>;
  hidden: Generated<boolean>;
  forgottenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CalendarReminderSpec {
  method: "popup" | "email";
  minutes: number;
  allDay?: boolean;
}

export interface CalendarTable {
  id: string;
  organizationId: string;
  /** null = twodb calendar (no provider). */
  accountId: string | null;
  ownerUserId: string;
  providerCalendarId: string | null;
  name: string;
  description: string | null;
  color: Generated<string>;
  timezone: Generated<string>;
  /** default | regular | holiday | birthdays | subscription | invitations. */
  kind: Generated<string>;
  subscriptionUrl: string | null;
  /** owner | writer | reader | free_busy. */
  accessRole: Generated<string>;
  isPrimary: Generated<boolean>;
  defaultReminders: Json<CalendarReminderSpec[]>;
  allowedConference: ColumnType<string[], string[] | undefined, string[]>;
  syncCursor: string | null;
  ctag: string | null;
  syncEnabled: Generated<boolean>;
  lastSyncedAt: Date | null;
  lastError: string | null;
  feedTokenHash: string | null;
  occurrenceFrom: ColumnType<Date | null, string | null | undefined, string | null>;
  occurrenceTo: ColumnType<Date | null, string | null | undefined, string | null>;
  providerData: Json<Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CalendarShareTable {
  id: string;
  organizationId: string;
  calendarId: string;
  /** user | org | email. */
  principalType: string;
  principal: string;
  /** owner | editor | viewer | free_busy. */
  role: string;
  providerRuleId: string | null;
  createdAt: Date;
}

export interface CalendarUserPrefTable {
  userId: string;
  calendarId: string;
  hidden: Generated<boolean>;
  color: string | null;
  name: string | null;
  sortOrder: Generated<number>;
  notify: Json<Record<string, unknown>>;
  updatedAt: Date;
}

export interface CalendarPerson {
  email: string;
  name?: string | null;
  self?: boolean;
}

export interface CalendarConference {
  type: "meet" | "teams" | "custom";
  url: string | null;
  phone?: string | null;
  pin?: string | null;
  /** Ask the provider to create a link on push. */
  create?: boolean;
  providerData?: Record<string, unknown>;
}

/** Field pinned after a rejected push: twodb shows the local value, the provider keeps its own. */
export interface LocalOnlyField {
  providerValue: unknown;
  remoteValue?: unknown;
}

export interface CalendarEventTable {
  id: string;
  organizationId: string;
  calendarId: string;
  uid: string;
  providerEventId: string | null;
  etag: string | null;
  sequence: Generated<number>;
  recurringEventId: string | null;
  originalStartAt: Date | null;
  originalStartDate: ColumnType<string | null, string | null | undefined, string | null>;
  rrule: ColumnType<string[] | null, string[] | null | undefined, string[] | null>;
  /** confirmed | tentative | cancelled. */
  status: Generated<string>;
  title: Generated<string>;
  descriptionHtml: string | null;
  location: string | null;
  geo: Json<Record<string, unknown> | null>;
  isAllDay: Generated<boolean>;
  startAt: Date | null;
  endAt: Date | null;
  /** yyyy-mm-dd; end exclusive. */
  startDate: ColumnType<string | null, string | null | undefined, string | null>;
  endDate: ColumnType<string | null, string | null | undefined, string | null>;
  startTz: string | null;
  endTz: string | null;
  isFloating: Generated<boolean>;
  /** opaque | transparent. */
  transparency: Generated<string>;
  /** default | public | private | confidential. */
  visibility: Generated<string>;
  /** default | out_of_office | focus_time | working_location | birthday. */
  eventType: Generated<string>;
  eventTypeProps: Json<Record<string, unknown>>;
  color: string | null;
  organizer: Json<CalendarPerson | null>;
  conference: Json<CalendarConference | null>;
  guestsCanModify: Generated<boolean>;
  guestsCanInviteOthers: Generated<boolean>;
  guestsCanSeeOthers: Generated<boolean>;
  attendeesOmitted: Generated<boolean>;
  attendeeText: Generated<string>;
  meetingRecordingId: string | null;
  /** local | provider | imip | ics_import. */
  source: Generated<string>;
  rawIcs: string | null;
  providerData: Json<Record<string, unknown>>;
  providerUpdatedAt: Date | null;
  /** none | awaiting_approval | pending | failed | conflict. */
  pushState: Generated<string>;
  localOnly: Generated<boolean>;
  localOnlyFields: Json<Record<string, LocalOnlyField>>;
  localDeletedAt: Date | null;
  createdByUserId: string | null;
  searchVector: ColumnType<string, never, never>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  /** user | provider. */
  deletedSource: string | null;
}

export interface CalendarEventAttendeeTable {
  id: string;
  eventId: string;
  email: string;
  name: string | null;
  contactId: string | null;
  userId: string | null;
  /** required | optional | chair | resource | non_participant. */
  role: Generated<string>;
  /** needs_action | accepted | declined | tentative | delegated. */
  status: Generated<string>;
  /** Rejected RSVP kept in twodb only. */
  localStatus: string | null;
  comment: string | null;
  additionalGuests: Generated<number>;
  isOrganizer: Generated<boolean>;
  isSelf: Generated<boolean>;
  respondedAt: Date | null;
  proposedStart: Date | null;
  proposedEnd: Date | null;
}

export interface CalendarEventReminderTable {
  id: string;
  eventId: string;
  /** null = event-level (synced); set = personal. */
  userId: string | null;
  /** popup | email. */
  method: Generated<string>;
  minutesBefore: number;
  localOnly: Generated<boolean>;
}

export interface CalendarEventAttachmentTable {
  id: string;
  organizationId: string;
  eventId: string;
  mediaAssetId: string | null;
  url: string | null;
  title: string;
  mimeType: string | null;
  size: number | null;
  providerFileId: string | null;
  createdAt: Date;
}

export interface CalendarOccurrenceTable {
  eventId: string;
  overrideEventId: string | null;
  calendarId: string;
  startAt: Date;
  endAt: Date;
  isAllDay: boolean;
  startDate: ColumnType<string | null, string | null | undefined, string | null>;
  endDate: ColumnType<string | null, string | null | undefined, string | null>;
  status: string;
  transparency: string;
}

export interface CalendarChangeTable {
  id: string;
  organizationId: string;
  accountId: string;
  calendarId: string;
  eventId: string;
  /** create | update | delete | move | rsvp | cancel_instance | reminders. */
  op: string;
  /** this | following | all. */
  recurrenceScope: Generated<string>;
  occurrenceStart: Date | null;
  fields: ColumnType<string[], string[] | undefined, string[]>;
  diff: Json<Record<string, { before: unknown; after: unknown }>>;
  impact: Json<Record<string, unknown>>;
  payload: Json<Record<string, unknown>>;
  baseSnapshot: Json<Record<string, unknown> | null>;
  baseEtag: string | null;
  remoteChangedFields: ColumnType<string[], string[] | undefined, string[]>;
  remoteDeleted: Generated<boolean>;
  /** awaiting_approval | pending | sending | done | failed | conflict | rejected | discarded. */
  status: string;
  createdByUserId: string | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  attempts: Generated<number>;
  nextAttemptAt: Date | null;
  lastError: string | null;
  doneAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarReminderDeliveryTable {
  id: string;
  userId: string;
  eventId: string;
  occurrenceStart: Date;
  minutesBefore: number;
  method: string;
  firedAt: Date;
  dismissedAt: Date | null;
  snoozedUntil: Date | null;
}

export interface CalendarImipMessageTable {
  id: string;
  organizationId: string;
  emailMessageId: string;
  method: string;
  uid: string;
  sequence: Generated<number>;
  eventId: string | null;
  result: string | null;
  processedAt: Date;
}

export interface CalendarUserSettingsTable {
  userId: string;
  organizationId: string;
  settings: Json<Record<string, unknown>>;
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
  runner_metric: RunnerMetricTable;
  teams_account: TeamsAccountTable;
  code_directory: CodeDirectoryTable;
  code_session: CodeSessionTable;
  code_session_message: CodeSessionMessageTable;
  code_session_job: CodeSessionJobTable;
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
  space: SpaceTable;
  llm_model: LlmModelTable;
  storage_backend: StorageBackendTable;
  storage_bucket: StorageBucketTable;
  storage_entry: StorageEntryTable;
  code_session_artifact: CodeSessionArtifactTable;
  media_asset: MediaAssetTable;
  meeting_recording: MeetingRecordingTable;
  meeting_recording_track: MeetingRecordingTrackTable;
  chat_channel: ChatChannelTable;
  chat_channel_member: ChatChannelMemberTable;
  chat_message: ChatMessageTable;
  chat_reaction: ChatReactionTable;
  chat_pin: ChatPinTable;
  chat_saved: ChatSavedTable;
  chat_draft: ChatDraftTable;
  chat_read_state: ChatReadStateTable;
  note_node: NoteNodeTable;
  project: ProjectTable;
  project_member: ProjectMemberTable;
  subproject: SubprojectTable;
  project_status: ProjectStatusTable;
  label_group: LabelGroupTable;
  label: LabelTable;
  project_tag: ProjectTagTable;
  milestone: MilestoneTable;
  sprint: SprintTable;
  project_link: ProjectLinkTable;
  ticket: TicketTable;
  ticket_dependency: TicketDependencyTable;
  ticket_label: TicketLabelTable;
  ticket_tag: TicketTagTable;
  ticket_comment: TicketCommentTable;
  ticket_checklist_item: TicketChecklistItemTable;
  server_setting: ServerSettingTable;
  api_key: OrgApiKeyTable;
  device: DeviceTable;
  notification: NotificationTable;
  notification_recipient: NotificationRecipientTable;
  notification_preference: NotificationPreferenceTable;
  connected_account: ConnectedAccountTable;
  connected_account_member: ConnectedAccountMemberTable;
  connected_account_webhook: ConnectedAccountWebhookTable;
  contact_book: ContactBookTable;
  contact: ContactTable;
  calendar: CalendarTable;
  calendar_share: CalendarShareTable;
  calendar_user_pref: CalendarUserPrefTable;
  calendar_event: CalendarEventTable;
  calendar_event_attendee: CalendarEventAttendeeTable;
  calendar_event_reminder: CalendarEventReminderTable;
  calendar_event_attachment: CalendarEventAttachmentTable;
  calendar_occurrence: CalendarOccurrenceTable;
  calendar_change: CalendarChangeTable;
  calendar_reminder_delivery: CalendarReminderDeliveryTable;
  calendar_imip_message: CalendarImipMessageTable;
  calendar_user_settings: CalendarUserSettingsTable;
  email_thread: EmailThreadTable;
  email_message: EmailMessageTable;
  email_attachment: EmailAttachmentTable;
  email_label: EmailLabelTable;
  email_thread_label: EmailThreadLabelTable;
  email_sender_rule: EmailSenderRuleTable;
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
