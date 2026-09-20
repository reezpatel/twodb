/**
 * The canonical TwoDB LLM protocol. Every provider plugin maps its native
 * wire format into these shapes; consumers (agents, chat, …) speak only
 * these. Deliberately resembles the OpenAI Chat Completions surface.
 */

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type TwodbTextPart = { type: "text"; text: string };
export type TwodbImagePart = { type: "image"; url: string; detail?: "low" | "high" | "auto" };
export type TwodbAudioPart = { type: "audio"; url: string; format?: string };
export type TwodbContentPart = TwodbTextPart | TwodbImagePart | TwodbAudioPart;

export type TwodbMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | TwodbContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: TwodbToolCall[] }
  | { role: "tool"; tool_call_id: string; name?: string; content: string };

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export type TwodbFunctionDef = {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
};

export type TwodbTool = { type: "function"; function: TwodbFunctionDef };

export type TwodbToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type TwodbToolChoice = "auto" | "none" | "required" | { type: "function"; function: { name: string } };

// ---------------------------------------------------------------------------
// Completions
// ---------------------------------------------------------------------------

export type TwodbThinkingLevel = "off" | "low" | "medium" | "high";

export type TwodbCompletionRequest = {
  model: string;
  messages: TwodbMessage[];
  tools?: TwodbTool[];
  tool_choice?: TwodbToolChoice;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  thinking?: { level: TwodbThinkingLevel; budget_tokens?: number };
  response_format?: {
    type: "text" | "json_object" | "json_schema";
    json_schema?: { name: string; schema: Record<string, unknown> };
  };
  stop?: string[];
  metadata?: Record<string, string>;
};

export type TwodbFinishReason = "stop" | "length" | "tool_calls" | "content_filter" | "error";

export type TwodbUsage = {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens?: number;
  cached_input_tokens?: number;
};

export type TwodbChoice = {
  index: number;
  message: { role: "assistant"; content: string | null; tool_calls?: TwodbToolCall[] };
  finish_reason: TwodbFinishReason;
};

export type TwodbCompletionResponse = {
  id: string;
  model: string;
  choices: TwodbChoice[];
  usage?: TwodbUsage;
};

export type TwodbStreamDelta = {
  content?: string;
  reasoning?: string;
  tool_calls?: Array<TwodbToolCall & { index: number }>;
};

export type TwodbStreamEvent =
  | { type: "start"; id: string; model: string }
  | { type: "chunk"; index: number; delta: TwodbStreamDelta }
  | { type: "finish"; index: number; finish_reason: TwodbFinishReason }
  | { type: "usage"; usage: TwodbUsage }
  | { type: "error"; error: string };

// ---------------------------------------------------------------------------
// Model catalog
// ---------------------------------------------------------------------------

export type TwodbModelSupport = {
  images?: boolean;
  audio?: boolean;
  video?: boolean;
  tool_calling?: boolean;
  streaming?: boolean;
  json_mode?: boolean;
  system_prompt?: boolean;
  prompt_caching?: boolean;
};

export type TwodbModelThinking = {
  supported: boolean;
  levels: TwodbThinkingLevel[];
  default?: TwodbThinkingLevel;
};

export type TwodbModelInfo = {
  id: string;
  display_name: string;
  context_window: number;
  max_output_tokens?: number;
  thinking?: TwodbModelThinking;
  supports?: TwodbModelSupport;
  knowledge_cutoff?: string;
  aliases?: string[];
  deprecated?: boolean;
};

// ---------------------------------------------------------------------------
// Workspace tuning — defaults, connection overrides
// ---------------------------------------------------------------------------

export type TwodbTruncationPolicyType = "keep_system_first" | "sliding_window" | "drop_oldest_turns" | "none";

export type TwodbTruncationPolicy = {
  type: TwodbTruncationPolicyType;
  max_turns?: number;
  preserve_tool_pairs?: boolean;
};

export type TwodbModelTuning = {
  effective_context_window_percent?: number;
  truncation_policy?: TwodbTruncationPolicy;
};

export type TwodbConnectionOverrides = TwodbModelTuning & {
  models?: Record<string, TwodbModelTuning>;
  governance?: TwodbConnectionGovernance;
};

export type TwodbLlmWorkspaceSettings = {
  effective_context_window_percent: number;
  truncation_policy: TwodbTruncationPolicy;
  default_model: { provider: string; model: string } | null;
  queue: TwodbQueueSettings;
};

// ---------------------------------------------------------------------------
// Governance — limits, rate limiting, concurrency, queueing
// ---------------------------------------------------------------------------

// rolling windows: monthly ≈ 30d, weekly = 7d
export type TwodbQuotaPeriod = "monthly" | "weekly" | "5h";

export type TwodbTokenQuota = {
  period: TwodbQuotaPeriod;
  input_tokens?: number;
  output_tokens?: number;
};

export type TwodbRateLimit = {
  requests: number;
  window_minutes: number;
};

export type TwodbConnectionGovernance = {
  concurrency?: number;
  rate_limit?: TwodbRateLimit | null;
  limits?: TwodbTokenQuota[];
};

export type TwodbQueueSettings = {
  max_wait_ms: number;
};

// ---------------------------------------------------------------------------
// Usage tracking — cost balance or windowed quotas, per provider
// ---------------------------------------------------------------------------

export type TwodbUsageQuota =
  | { kind: "percent"; window: TwodbQuotaPeriod; used_percent: number; resets_at: string | null }
  | { kind: "credits"; window: TwodbQuotaPeriod; used: number; limit: number | null; resets_at: string | null };

export type TwodbUsageSnapshot =
  | { kind: "cost"; balance: { amount: number | null; currency: string | null; as_of: string | null } }
  | { kind: "quota"; quotas: TwodbUsageQuota[] };

export interface TwodbLlmUsage {
  ttlMs: number;
  fetch(ctx: TwodbAdapterContext): Promise<TwodbUsageSnapshot>;
}

// ---------------------------------------------------------------------------
// Provider adapters — the interfaces every provider plugin implements
// ---------------------------------------------------------------------------

export type TwodbToolRoundResult = {
  tool_calls: TwodbToolCall[];
  content: string | null;
  usage?: TwodbUsage;
};

export type TwodbAdapterContext = {
  connectionId: string;
  config: Record<string, unknown>;
};

/** Interface 1 — tool usage: single structured round with tools. */
export interface TwodbLlmToolsUsage {
  runToolRound(request: TwodbCompletionRequest & { tools: TwodbTool[] }, ctx: TwodbAdapterContext): Promise<TwodbToolRoundResult>;
}

/** Interface 2 — completions: full surface incl. streaming and tool calls. */
export interface TwodbLlmCompletions {
  complete(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): Promise<TwodbCompletionResponse>;
  stream(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): AsyncIterable<TwodbStreamEvent>;
}

export interface TwodbLlmProviderAdapter {
  providerId: string;
  displayName: string;
  models: TwodbModelInfo[];
  tools: TwodbLlmToolsUsage;
  completions: TwodbLlmCompletions;
  usage?: TwodbLlmUsage;
}
