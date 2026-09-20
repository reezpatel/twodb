import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type {
  TwodbAdapterContext,
  TwodbCompletionRequest,
  TwodbCompletionResponse,
  TwodbFinishReason,
  TwodbLlmProviderAdapter,
  TwodbMessage,
  TwodbModelInfo,
  TwodbQuotaPeriod,
  TwodbStreamEvent,
  TwodbTool,
  TwodbToolChoice,
  TwodbToolRoundResult,
  TwodbUsage,
  TwodbUsageSnapshot,
} from "@twodb/contracts";
import type { KimiConnectionConfig } from "../shared/api";
import {
  REQUEST_TIMEOUT_MS,
  postAnthropicMessages,
  sanitizeError,
  streamAnthropicMessages,
  type AnthropicMessage,
  type AnthropicMessagesRequest,
  type AnthropicThinkingConfig,
  type AnthropicTool,
  type AnthropicToolChoice,
} from "./anthropic";

const MODELS: TwodbModelInfo[] = [
  {
    id: "k3",
    display_name: "Kimi K3",
    context_window: 1048576,
    max_output_tokens: 131072,
    thinking: { supported: true, levels: ["off", "low", "high"], default: "high" },
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true, images: true, prompt_caching: true },
  },
  {
    id: "k3-256k",
    display_name: "Kimi K3-256K",
    context_window: 262144,
    max_output_tokens: 131072,
    thinking: { supported: true, levels: ["off", "low", "high"], default: "high" },
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true, images: true, prompt_caching: true },
  },
  {
    id: "kimi-for-coding",
    display_name: "Kimi K2.7 Code",
    context_window: 262144,
    max_output_tokens: 32768,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true, images: true, prompt_caching: true },
  },
  {
    id: "kimi-for-coding-highspeed",
    display_name: "Kimi For Coding HighSpeed",
    context_window: 262144,
    max_output_tokens: 32768,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true, images: true, prompt_caching: true },
  },
];

const DEFAULT_BASE_URL = "https://api.kimi.com/coding/v1";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function connectionOf(ctx: TwodbAdapterContext): { apiKey: string; baseUrl: string } {
  const config = ctx.config as Partial<KimiConnectionConfig>;
  const apiKey = String(config.api_key ?? "").trim();
  if (!apiKey) {
    throw new Error("Kimi for Coding is not configured: missing api key");
  }
  const override = String(config.base_url ?? "")
    .trim()
    .replace(/\/+$/, "");
  return { apiKey, baseUrl: override || DEFAULT_BASE_URL };
}

function parseJsonObject(json: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(json || "{}")) ?? {};
  } catch {
    return {};
  }
}

function toAnthropicMessages(messages: TwodbMessage[]): {
  system: string | undefined;
  messages: AnthropicMessage[];
} {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];

  const pushBlock = (role: "user" | "assistant", block: AnthropicMessage["content"][number]): void => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(block);
    else out.push({ role, content: [block] });
  };

  for (const message of messages) {
    switch (message.role) {
      case "system":
        systemParts.push(message.content);
        break;
      case "user":
        for (const part of Array.isArray(message.content) ? message.content : [{ type: "text" as const, text: message.content }]) {
          if (part.type === "text") pushBlock("user", { type: "text", text: part.text });
        }
        break;
      case "assistant": {
        if (message.content) {
          pushBlock("assistant", { type: "text", text: message.content });
        }
        for (const call of message.tool_calls ?? []) {
          pushBlock("assistant", {
            type: "tool_use",
            id: call.id,
            name: call.function.name,
            input: parseJsonObject(call.function.arguments),
          });
        }
        break;
      }
      case "tool":
        pushBlock("user", {
          type: "tool_result",
          tool_use_id: message.tool_call_id,
          content: message.content,
        });
        break;
    }
  }

  if (!out.length) out.push({ role: "user", content: [{ type: "text", text: "" }] });
  return {
    system: systemParts.length ? systemParts.join("\n\n") : undefined,
    messages: out,
  };
}

function toAnthropicTools(tools: TwodbTool[]): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description ?? "No description provided",
    input_schema: tool.function.parameters,
  }));
}

function toAnthropicToolChoice(choice: TwodbToolChoice): AnthropicToolChoice {
  if (choice === "required") return { type: "any" };
  if (typeof choice === "object") return { type: "tool", name: choice.function.name };
  return { type: "auto" };
}

function toThinkingConfig(request: TwodbCompletionRequest, maxTokens: number): AnthropicThinkingConfig | undefined {
  const level = request.thinking?.level;
  if (!level || level === "off") return undefined;
  const fraction = level === "low" ? 0.25 : level === "medium" ? 0.5 : 0.75;
  const budget = request.thinking?.budget_tokens ?? Math.max(1024, Math.floor(maxTokens * fraction));
  return {
    type: "enabled",
    budget_tokens: Math.max(1024, Math.min(budget, Math.max(1024, maxTokens - 1024))),
  };
}

function toAnthropicRequest(request: TwodbCompletionRequest): AnthropicMessagesRequest {
  const model = MODELS.find((entry) => entry.id === request.model);
  const maxTokens = request.max_tokens ?? model?.max_output_tokens ?? 16384;
  const tools = request.tool_choice === "none" ? undefined : request.tools;
  const thinking = toThinkingConfig(request, maxTokens);
  const { system, messages } = toAnthropicMessages(request.messages);
  return {
    model: request.model,
    maxTokens,
    ...(system ? { system } : {}),
    messages,
    ...(tools?.length
      ? {
          tools: toAnthropicTools(tools),
          ...(request.tool_choice && request.tool_choice !== "none" ? { tool_choice: toAnthropicToolChoice(request.tool_choice) } : {}),
        }
      : {}),
    ...(thinking ? { thinking } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...(request.stop?.length ? { stop_sequences: request.stop } : {}),
  };
}

function toFinishReason(stopReason: string | null | undefined): TwodbFinishReason {
  switch (stopReason) {
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    case "refusal":
      return "content_filter";
    default:
      return "stop";
  }
}

function usageNumber(usage: Record<string, unknown> | undefined, key: string): number {
  const value = usage?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toUsage(usage: Record<string, unknown> | undefined): TwodbUsage {
  const cached = usageNumber(usage, "cache_read_input_tokens");
  return {
    input_tokens: usageNumber(usage, "input_tokens"),
    output_tokens: usageNumber(usage, "output_tokens"),
    ...(cached ? { cached_input_tokens: cached } : {}),
  };
}

async function completeImpl(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): Promise<TwodbCompletionResponse> {
  const { apiKey, baseUrl } = connectionOf(ctx);
  const response = await postAnthropicMessages(`${baseUrl}/messages`, apiKey, toAnthropicRequest(request));
  const blocks = Array.isArray(response.content) ? response.content : [];
  const text = blocks
    .filter((block) => block["type"] === "text")
    .map((block) => String(block["text"] ?? ""))
    .join("");
  const toolCalls = blocks
    .filter((block) => block["type"] === "tool_use")
    .map((block) => ({
      id: String(block["id"] ?? ""),
      type: "function" as const,
      function: {
        name: String(block["name"] ?? ""),
        arguments: JSON.stringify(asRecord(block["input"]) ?? {}),
      },
    }));
  return {
    id: response.id ?? `msg-${crypto.randomUUID()}`,
    model: response.model ?? request.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text || null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: toFinishReason(response.stop_reason),
      },
    ],
    usage: toUsage(response.usage),
  };
}

type StreamBlock = { type: string; id: string; name: string; toolIndex: number };

async function* streamImpl(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): AsyncGenerator<TwodbStreamEvent> {
  const blocks = new Map<number, StreamBlock>();
  let toolCount = 0;
  let stopReason: string | null = null;
  let inputUsage: Record<string, unknown> | undefined;
  let outputTokens = 0;

  try {
    const { apiKey, baseUrl } = connectionOf(ctx);
    for await (const event of streamAnthropicMessages(`${baseUrl}/messages`, apiKey, toAnthropicRequest(request))) {
      switch (event.type) {
        case "message_start":
          inputUsage = event.message.usage;
          yield {
            type: "start",
            id: event.message.id ?? `msg-${crypto.randomUUID()}`,
            model: request.model,
          };
          break;
        case "content_block_start": {
          const block = event.content_block;
          const type = String(block["type"] ?? "text");
          blocks.set(event.index, {
            type,
            id: String(block["id"] ?? ""),
            name: String(block["name"] ?? ""),
            toolIndex: type === "tool_use" ? toolCount++ : -1,
          });
          break;
        }
        case "content_block_delta": {
          const delta = event.delta;
          const block = blocks.get(event.index);
          if (delta["type"] === "text_delta") {
            yield {
              type: "chunk",
              index: 0,
              delta: { content: String(delta["text"] ?? "") },
            };
          } else if (delta["type"] === "thinking_delta") {
            yield {
              type: "chunk",
              index: 0,
              delta: { reasoning: String(delta["thinking"] ?? "") },
            };
          } else if (delta["type"] === "input_json_delta" && block) {
            yield {
              type: "chunk",
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: block.toolIndex,
                    id: block.id,
                    type: "function",
                    function: {
                      name: block.name,
                      arguments: String(delta["partial_json"] ?? ""),
                    },
                  },
                ],
              },
            };
          }
          break;
        }
        case "message_delta":
          stopReason = event.delta.stop_reason ?? stopReason;
          if (typeof event.usage?.output_tokens === "number") {
            outputTokens = event.usage.output_tokens;
          }
          break;
        case "message_stop": {
          const cached = usageNumber(inputUsage, "cache_read_input_tokens");
          yield { type: "finish", index: 0, finish_reason: toFinishReason(stopReason) };
          yield {
            type: "usage",
            usage: {
              input_tokens: usageNumber(inputUsage, "input_tokens"),
              output_tokens: outputTokens,
              ...(cached ? { cached_input_tokens: cached } : {}),
            },
          };
          return;
        }
        case "error":
          yield {
            type: "error",
            error: sanitizeError(event.error.message ?? "stream failed"),
          };
          return;
      }
    }
    yield { type: "error", error: "stream ended without message_stop" };
  } catch (error) {
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runToolRoundImpl(request: TwodbCompletionRequest & { tools: TwodbTool[] }, ctx: TwodbAdapterContext): Promise<TwodbToolRoundResult> {
  const response = await completeImpl(request, ctx);
  const choice = response.choices[0];
  return {
    tool_calls: choice.message.tool_calls ?? [],
    content: choice.message.content,
    ...(response.usage ? { usage: response.usage } : {}),
  };
}

function numberField(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function parseResetMs(data: Record<string, unknown>): number | undefined {
  for (const key of ["reset_at", "resetAt", "reset_time", "resetTime"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  for (const key of ["reset_in", "resetIn", "ttl"]) {
    const seconds = numberField(data, [key]);
    if (seconds !== undefined && seconds > 0) {
      return Date.now() + Math.round(seconds * 1000);
    }
  }
  const window = asRecord(data["window"]);
  if (window) {
    const seconds = numberField(window, ["duration"]);
    if (seconds !== undefined && seconds > 0) {
      return Date.now() + Math.round(seconds * 1000);
    }
  }
  return undefined;
}

function toQuotaPeriod(label: string): TwodbQuotaPeriod {
  const normalized = label.toLowerCase();
  if (normalized.includes("5h") || normalized.includes("5 h")) return "5h";
  if (normalized.includes("weekly") || normalized.includes("week") || normalized.includes("7d")) {
    return "weekly";
  }
  return "monthly";
}

type UsageWindow = {
  window: TwodbQuotaPeriod;
  used: number;
  limit: number;
  resetsAt?: number;
};

function toUsageWindow(data: Record<string, unknown>, defaultLabel: string): UsageWindow | undefined {
  const limit = numberField(data, ["limit"]);
  let used = numberField(data, ["used"]);
  if (used === undefined) {
    const remaining = numberField(data, ["remaining"]);
    if (remaining !== undefined && limit !== undefined) {
      used = limit - remaining;
    }
  }
  if (used === undefined && limit === undefined) return undefined;

  const label = stringField(data, ["name", "title"]) ?? defaultLabel;
  const resetsAt = parseResetMs(data);
  return {
    window: toQuotaPeriod(label),
    used: used ?? 0,
    limit: limit ?? 0,
    ...(resetsAt ? { resetsAt } : {}),
  };
}

function limitLabel(item: Record<string, unknown>, detail: Record<string, unknown>, window: Record<string, unknown>, index: number): string {
  for (const key of ["name", "title", "scope"]) {
    const value = stringField(item, [key]) ?? stringField(detail, [key]);
    if (value) return value;
  }

  const duration = numberField(window, ["duration"]) ?? numberField(item, ["duration"]) ?? numberField(detail, ["duration"]);
  const timeUnit = String(window["timeUnit"] ?? item["timeUnit"] ?? detail["timeUnit"] ?? "");

  if (duration !== undefined && duration > 0) {
    if (timeUnit.includes("MINUTE")) {
      if (duration >= 60 && duration % 60 === 0) {
        return `${duration / 60}h limit`;
      }
      return `${duration}m limit`;
    }
    if (timeUnit.includes("HOUR")) return `${duration}h limit`;
    if (timeUnit.includes("DAY")) return `${duration}d limit`;
    return `${duration}s limit`;
  }

  return `Limit #${index + 1}`;
}

function parseUsageWindows(payload: Record<string, unknown>): UsageWindow[] {
  const data = asRecord(payload["data"]);
  const usage = data?.["usage"] ?? payload["usage"];
  const limits = data?.["limits"] ?? payload["limits"];
  const windows: UsageWindow[] = [];

  const usageRecord = asRecord(usage);
  if (usageRecord) {
    const row = toUsageWindow(usageRecord, "Weekly limit");
    if (row) windows.push(row);
  }

  if (Array.isArray(limits)) {
    for (let index = 0; index < limits.length; index++) {
      const item = asRecord(limits[index]);
      if (!item) continue;
      const detail = asRecord(item["detail"]) ?? item;
      const window = asRecord(item["window"]) ?? {};
      const row = toUsageWindow(detail, limitLabel(item, detail, window, index));
      if (row) windows.push(row);
    }
  }

  return windows;
}

async function fetchUsage(ctx: TwodbAdapterContext): Promise<TwodbUsageSnapshot> {
  const { apiKey, baseUrl } = connectionOf(ctx);
  const response = await fetch(`${baseUrl}/usages`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Kimi API error ${response.status}: ${sanitizeError(text)}`);
  }

  let payload: Record<string, unknown>;
  try {
    payload = asRecord(JSON.parse(text)) ?? {};
  } catch {
    throw new Error("Kimi usage returned invalid JSON");
  }

  const quotas = parseUsageWindows(payload).map((window) => ({
    kind: "percent" as const,
    window: window.window,
    used_percent: window.limit > 0 ? Math.min(100, (window.used / window.limit) * 100) : 0,
    resets_at: window.resetsAt ? new Date(window.resetsAt).toISOString() : null,
  }));
  if (!quotas.length) {
    throw new Error("Unexpected Kimi usage response structure");
  }
  return { kind: "quota", quotas };
}

const KimiAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.kimi",
  displayName: "Kimi for Coding (global)",
  models: MODELS,
  tools: {
    runToolRound: runToolRoundImpl,
  },
  completions: {
    complete: completeImpl,
    stream: streamImpl,
  },
  usage: {
    ttlMs: 15 * 60_000,
    fetch: fetchUsage,
  },
};

const KimiServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", KimiAdapter);
  },
} satisfies ServicePlugin;

export default KimiServicePlugin;
