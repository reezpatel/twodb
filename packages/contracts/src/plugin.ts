import type { FastifyInstance as FastifyInstanceBase } from "fastify";

/**
 * Structural stand-in for react-pluggable's IPlugin, declared here so the
 * pure-types contracts package doesn't import it — its bundled d.ts
 * predates React 19 (React.SFC) and breaks under skipLibCheck: false.
 * The pluginStore member is assigned by the store at install time; twodb
 * code never reads it.
 */
export interface IPlugin {
  getPluginName(): string;
  getDependencies(): string[];
  init(pluginStore: unknown): void;
  activate(): void;
  deactivate(): void;
}

export type NodeInvokeStream = (stream: "stdout" | "stderr", chunk: string) => void;

export type NodeInvokeOptions = {
  timeoutMs?: number;
  onStream?: NodeInvokeStream;
  signal?: AbortSignal;
};

/**
 * Cross-plugin RPC onto a node agent. Actions and payloads are owned by the
 * node plugin's wire protocol (`read_file`, `write_file`, `list_dir`,
 * `find_file`, `run_command`, `cancel_command`); callers pass through.
 */
export type NodeInvokeFn = (nodeId: string, action: string, payload?: unknown, options?: NodeInvokeOptions) => Promise<unknown>;

/** Workspace-scoped node summary, safe to hand to other plugins. */
export type NodeSummary = {
  id: string;
  name: string;
  status: string;
};

/** Decorated by the node plugin: list the workspace's registered nodes. */
export type NodeListFn = (workspaceId: string) => Promise<NodeSummary[]>;

/** Decorated by the node plugin: look up one node within the workspace. */
export type NodeGetFn = (nodeId: string, workspaceId: string) => Promise<NodeSummary | undefined>;

export type NodeDirMatch = {
  name: string;
  /** absolute path on the node */
  path: string;
  /** path relative to the node's root */
  relativePath: string;
};

export type NodeFindDirsOptions = {
  maxResults?: number;
  timeoutMs?: number;
};

/** Decorated by the node plugin: fuzzy-search directories on a node agent. */
export type NodeFindDirsFn = (nodeId: string, query: string, options?: NodeFindDirsOptions) => Promise<NodeDirMatch[]>;

/** Live system stats from a node's last heartbeat. */
export type NodeStats = {
  online: boolean;
  hostname: string | null;
  platform: string | null;
  cpus: number | null;
  loadavg: number[] | null;
  memoryTotal: number | null;
  memoryFree: number | null;
  /** agent-reported activity state ("idle" | "busy") */
  activity: string | null;
  seenAt: string | null;
};

/** Decorated by the node plugin: latest heartbeat stats for one node. */
export type NodeStatsFn = (nodeId: string) => Promise<NodeStats | undefined>;

// --- agent thread runtime (structural — agent plugin owns the real types) ---

/** Decrypted credentials + config for one agent row, handed to provider factories. */
export type AgentProviderCreds = {
  apiKey?: string;
  fields: Record<string, string>;
  config: Record<string, string>;
};

/**
 * Provider plugins (agent-providers/*) build an AgentProvider from row
 * credentials. Return type is structural — the agent plugin casts to its
 * AgentProvider contract from shared-backend.
 */
export type AgentProviderFactory = (creds: AgentProviderCreds) => unknown | Promise<unknown>;

export type AgentProviderRegistry = {
  register(providerId: string, factory: AgentProviderFactory): void;
  get(providerId: string): AgentProviderFactory | undefined;
};

export type AgentThreadListener = (payload: Record<string, unknown>) => void;

/** Persisted message, as emitted on the handle's "message" event. */
export type ThreadMessageEventPayload = {
  message: Record<string, unknown>;
};

/** Token-delta event ("message-update"): partial message + the raw delta. */
export type ThreadMessageUpdatePayload = {
  message: Record<string, unknown>;
  delta: Record<string, unknown>;
};

/** Cumulative usage for the current/last run, emitted as it changes. */
export type ThreadUsagePayload = {
  input_tokens: number;
  output_tokens: number;
  /** estimated context-window tokens for the next prompt */
  context_tokens: number;
  /** live output tokens/sec while running; null when idle */
  tokens_per_second: number | null;
  running: boolean;
};

/**
 * Live handle onto a thread. The underlying pi agent is rebuilt per prompt
 * from persisted messages + currently registered tools, so tool registration
 * and config edits take effect on the next run.
 */
export type AgentThreadHandle = {
  readonly id: string;
  info(): Promise<Record<string, unknown>>;
  prompt(input: { text: string; images?: unknown[] }): Promise<unknown[]>;
  /** Upserts by tool name (idempotent). */
  registerTool(tool: unknown): void;
  registerTools(tools: unknown[]): void;
  removeTool(name: string): void;
  stop(): boolean;
  isRunning(): boolean;
  /**
   * Events: "message" (persisted end), "message-start", "message-update"
   * (token delta), "tool-start" | "tool-update" | "tool-end", "usage",
   * "run-finished", "run-failed".
   */
  on(event: string, listener: AgentThreadListener): () => void;
};

export type AgentListMessagesOptions = {
  /** only messages with seq < before (exclusive cursor) */
  before?: number;
  /** only messages with seq > after (exclusive cursor, catch-up replay) */
  after?: number;
  /** page size; service clamps to a sane bound */
  limit?: number;
};

export type AgentCreateThreadInput = {
  workspaceId: string;
  agentId: string;
  threadIntent?: string | null;
  tools?: unknown[];
  createdBy?: string;
};

export type AgentRuntime = {
  createNewThread(input: AgentCreateThreadInput): Promise<AgentThreadHandle>;
  getThread(threadId: string): Promise<AgentThreadHandle | undefined>;
  /**
   * Read persisted messages newest-first in seq order. Without options,
   * returns the latest page; pass `before` to walk backwards.
   */
  listMessages(threadId: string, options?: AgentListMessagesOptions): Promise<unknown[]>;
  /** Full, untrimmed message by id (for "view full output"). */
  getMessage(messageId: string): Promise<unknown | undefined>;
  /** Summarize + prune a thread's history in place (seq stays monotonic). */
  compactThread(threadId: string): Promise<void>;
  /** Delete all of a thread's messages in place; the thread row survives. */
  clearThread(threadId: string): Promise<void>;
  /** Rebind a thread to a different agent connection (mid-session switch). */
  setThreadAgent(threadId: string, agentId: string): Promise<void>;
  isRunning(threadId: string): boolean;
  stop(threadId: string): boolean;
};

/** Workspace-scoped agent config summary, for pickers in other plugins. */
export type AgentSummary = {
  id: string;
  name: string;
  provider: string;
  model: string | null;
  enabled: boolean;
};

/** Decorated by the agent plugin: list the workspace's agent configs. */
export type AgentListFn = (workspaceId: string) => Promise<AgentSummary[]>;

export interface TwodbFastifyInstance extends FastifyInstanceBase {
  /** Decorated by the node plugin: execute actions on node agents. */
  nodeInvoke?: NodeInvokeFn;
  /** Decorated by the node plugin: list the workspace's nodes. */
  nodeList?: NodeListFn;
  /** Decorated by the node plugin: look up one node within a workspace. */
  nodeGet?: NodeGetFn;
  /** Decorated by the node plugin: fuzzy-search directories on a node. */
  nodeFindDirs?: NodeFindDirsFn;
  /** Decorated by the agent plugin: the thread runtime. */
  agents?: AgentRuntime;
  /** Decorated by the agent plugin: provider factories registered by agent-providers/* plugins. */
  agentProviderRegistry?: AgentProviderRegistry;
  /** Decorated by the agent plugin: list the workspace's agent configs. */
  agentList?: AgentListFn;
  /** Decorated by the node plugin: latest heartbeat stats for a node. */
  nodeStats?: NodeStatsFn;
}

export type TwodbFastifyPluginAsync = (instance: TwodbFastifyInstance, opts: unknown) => Promise<void>;
