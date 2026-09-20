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
  TwodbStreamEvent,
  TwodbTool,
  TwodbToolCall,
  TwodbToolChoice,
  TwodbToolRoundResult,
  TwodbUsage,
} from "@twodb/contracts";

const MODELS: TwodbModelInfo[] = [
  {
    id: "claude-sonnet-4.6",
    display_name: "Claude Sonnet 4.6",
    context_window: 200000,
    max_output_tokens: 64000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: { images: true, system_prompt: true, tool_calling: true, streaming: true, json_mode: true },
    knowledge_cutoff: "2025-09",
  },
  {
    id: "claude-opus-4.6",
    display_name: "Claude Opus 4.6",
    context_window: 200000,
    max_output_tokens: 64000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "high" },
    supports: { images: true, system_prompt: true, tool_calling: true, streaming: true, json_mode: true },
    knowledge_cutoff: "2025-09",
  },
  {
    id: "claude-haiku-4.5",
    display_name: "Claude Haiku 4.5",
    context_window: 200000,
    max_output_tokens: 32000,
    thinking: { supported: true, levels: ["low", "medium", "high"], default: "low" },
    supports: { images: true, system_prompt: true, tool_calling: true, streaming: true, json_mode: true },
    knowledge_cutoff: "2025-03",
  },
];

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const REQUEST_TIMEOUT_MS = 30_000;
const THINKING_FRACTIONS = { low: 0.25, medium: 0.5, high: 0.75 } as const;

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = { role: "user" | "assistant"; content: AnthropicContentBlock[] };

type AnthropicTool = { name: string; description: string; input_schema: Record<string, unknown> };

type AnthropicThinking = { type: "enabled"; budget_tokens: number };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

function eventData(rawEvent: string): string | null {
  const parts: string[] = [];
  for (const line of rawEvent.split("\n")) {
    const trimmed = line.replace(/\r$/, "");
    if (trimmed.startsWith("data:")) parts.push(trimmed.slice(5).trimStart());
  }
  return parts.length ? parts.join("\n") : null;
}

function parseJsonObject(json: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(json)) ?? {};
  } catch {
    return {};
  }
}

function imageBlock(url: string): AnthropicContentBlock | null {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(url.trim());
  if (!match) return null;
  return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
}

function toAnthropicMessages(messages: TwodbMessage[]): { system: string | undefined; messages: AnthropicMessage[] } {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];

  const pushBlock = (role: "user" | "assistant", block: AnthropicContentBlock): void => {
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
        if (typeof message.content === "string") {
          if (message.content) pushBlock("user", { type: "text", text: message.content });
        } else {
          for (const part of message.content) {
            if (part.type === "text") {
              if (part.text) pushBlock("user", { type: "text", text: part.text });
            } else if (part.type === "image") {
              const image = imageBlock(part.url);
              if (image) pushBlock("user", image);
            }
          }
        }
        break;
      case "assistant":
        if (message.content) pushBlock("assistant", { type: "text", text: message.content });
        for (const call of message.tool_calls ?? []) {
          pushBlock("assistant", { type: "tool_use", id: call.id, name: call.function.name, input: parseJsonObject(call.function.arguments) });
        }
        break;
      case "tool":
        pushBlock("user", { type: "tool_result", tool_use_id: message.tool_call_id, content: message.content });
        break;
    }
  }

  return { system: systemParts.length ? systemParts.join("\n\n") : undefined, messages: out };
}

function toAnthropicTools(tools: TwodbTool[]): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description ?? "",
    input_schema: tool.function.parameters,
  }));
}

function toToolChoice(choice: TwodbToolChoice | undefined): Record<string, string> | undefined {
  if (!choice) return undefined;
  if (choice === "auto") return { type: "auto" };
  if (choice === "none") return { type: "none" };
  if (choice === "required") return { type: "any" };
  return { type: "tool", name: choice.function.name };
}

function toThinkingConfig(thinking: TwodbCompletionRequest["thinking"], maxTokens: number): AnthropicThinking | undefined {
  if (!thinking || thinking.level === "off") return undefined;
  const budget = thinking.budget_tokens ?? Math.floor(maxTokens * THINKING_FRACTIONS[thinking.level]);
  return { type: "enabled", budget_tokens: Math.min(Math.max(1024, budget), Math.max(1024, maxTokens - 1)) };
}

function buildRequestBody(request: TwodbCompletionRequest): Record<string, unknown> {
  const maxTokens = request.max_tokens ?? 8192;
  const { system, messages } = toAnthropicMessages(request.messages);
  const thinking = toThinkingConfig(request.thinking, maxTokens);
  const tools = request.tools?.length ? toAnthropicTools(request.tools) : undefined;
  const toolChoice = toToolChoice(request.tool_choice);
  return {
    model: request.model,
    max_tokens: maxTokens,
    messages,
    ...(system ? { system } : {}),
    ...(tools ? { tools } : {}),
    ...(toolChoice ? { tool_choice: toolChoice } : {}),
    ...(thinking ? { thinking } : {}),
    ...(!thinking && request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(!thinking && request.top_p !== undefined ? { top_p: request.top_p } : {}),
    ...(request.stop?.length ? { stop_sequences: request.stop } : {}),
  };
}

function toFinishReason(stopReason: string | null): TwodbFinishReason {
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

function toUsage(usage: Record<string, unknown> | undefined): TwodbUsage {
  const record = usage ?? {};
  const cached = record["cache_read_input_tokens"];
  return {
    input_tokens: asNumber(record["input_tokens"]),
    output_tokens: asNumber(record["output_tokens"]),
    ...(typeof cached === "number" && Number.isFinite(cached) ? { cached_input_tokens: cached } : {}),
  };
}

function resolveEndpoint(config: Record<string, unknown>): { url: string; headers: Record<string, string> } {
  const accessToken = asText(config["access_token"]).trim();
  if (!accessToken) {
    throw new Error("not_implemented: oauth token refresh — the refresh flow is not clear, set access_token by hand for now");
  }
  return {
    url: MESSAGES_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "oauth-2025-04-20",
      "content-type": "application/json",
    },
  };
}

async function complete(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): Promise<TwodbCompletionResponse> {
  const { url, headers } = resolveEndpoint(ctx.config);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(buildRequestBody(request)),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${sanitizeError(await response.text())}`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Anthropic API returned invalid JSON");
  }
  const record = asRecord(payload);
  if (!record) throw new Error("Anthropic API returned an unexpected response");

  const textParts: string[] = [];
  const toolCalls: TwodbToolCall[] = [];
  for (const block of Array.isArray(record["content"]) ? record["content"] : []) {
    const entry = asRecord(block);
    if (!entry) continue;
    if (entry["type"] === "text" && typeof entry["text"] === "string") {
      textParts.push(entry["text"]);
    } else if (entry["type"] === "tool_use") {
      toolCalls.push({
        id: asText(entry["id"]),
        type: "function",
        function: { name: asText(entry["name"]), arguments: JSON.stringify(asRecord(entry["input"]) ?? {}) },
      });
    }
  }

  return {
    id: asText(record["id"]),
    model: asText(record["model"]) || request.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textParts.join("") || null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: toFinishReason(asText(record["stop_reason"]) || null),
      },
    ],
    usage: toUsage(asRecord(record["usage"]) ?? undefined),
  };
}

async function* streamCompletion(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): AsyncGenerator<TwodbStreamEvent> {
  const { url, headers } = resolveEndpoint(ctx.config);
  const controller = new AbortController();
  const connectTimeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...buildRequestBody(request), stream: true }),
    signal: controller.signal,
  }).finally(() => clearTimeout(connectTimeout));

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${sanitizeError(await response.text())}`);
  }
  if (!response.body) {
    throw new Error("Anthropic API returned an empty response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const toolCallIndexes = new Map<number, number>();
  let buffer = "";
  let messageId = "";
  let model = request.model;
  let inputUsage: Record<string, unknown> = {};
  let outputTokens = 0;
  let stopReason: string | null = null;
  let finished = false;

  const finishEvents = (): TwodbStreamEvent[] => [
    { type: "finish", index: 0, finish_reason: toFinishReason(stopReason) },
    { type: "usage", usage: { ...toUsage(inputUsage), output_tokens: outputTokens } },
  ];

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = /\r?\n\r?\n/.exec(buffer);
    while (boundary !== null) {
      const rawEvent = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      boundary = /\r?\n\r?\n/.exec(buffer);

      const data = eventData(rawEvent);
      if (!data || data === "[DONE]") continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        throw new Error(`Invalid SSE payload: ${sanitizeError(data)}`);
      }
      const event = asRecord(parsed);
      if (!event) continue;

      switch (event["type"]) {
        case "message_start": {
          const message = asRecord(event["message"]);
          messageId = asText(message?.["id"]) || messageId;
          model = asText(message?.["model"]) || model;
          inputUsage = asRecord(message?.["usage"]) ?? {};
          outputTokens = asNumber(inputUsage["output_tokens"]);
          yield { type: "start", id: messageId, model };
          break;
        }
        case "content_block_start": {
          const block = asRecord(event["content_block"]);
          if (block?.["type"] === "tool_use") {
            const index = toolCallIndexes.size;
            toolCallIndexes.set(asNumber(event["index"]), index);
            yield {
              type: "chunk",
              index: 0,
              delta: {
                tool_calls: [{ index, id: asText(block["id"]), type: "function", function: { name: asText(block["name"]), arguments: "" } }],
              },
            };
          }
          break;
        }
        case "content_block_delta": {
          const delta = asRecord(event["delta"]);
          const deltaType = delta?.["type"];
          if (deltaType === "text_delta") {
            const chunk = asText(delta?.["text"]);
            if (chunk) yield { type: "chunk", index: 0, delta: { content: chunk } };
          } else if (deltaType === "thinking_delta") {
            const chunk = asText(delta?.["thinking"]);
            if (chunk) yield { type: "chunk", index: 0, delta: { reasoning: chunk } };
          } else if (deltaType === "input_json_delta") {
            const chunk = asText(delta?.["partial_json"]);
            if (!chunk) break;
            const index = toolCallIndexes.get(asNumber(event["index"])) ?? 0;
            yield {
              type: "chunk",
              index: 0,
              delta: { tool_calls: [{ index, id: "", type: "function", function: { name: "", arguments: chunk } }] },
            };
          }
          break;
        }
        case "message_delta": {
          const delta = asRecord(event["delta"]);
          if (typeof delta?.["stop_reason"] === "string") stopReason = delta["stop_reason"];
          const usage = asRecord(event["usage"]);
          if (usage && asNumber(usage["output_tokens"]) > 0) outputTokens = asNumber(usage["output_tokens"]);
          break;
        }
        case "message_stop": {
          finished = true;
          for (const event2 of finishEvents()) yield event2;
          break;
        }
        case "error": {
          const error = asRecord(event["error"]);
          throw new Error(sanitizeError(asText(error?.["message"]) || "Anthropic stream failed"));
        }
      }
    }
  }

  if (!finished) {
    for (const event of finishEvents()) yield event;
  }
}

async function runToolRound(request: TwodbCompletionRequest & { tools: TwodbTool[] }, ctx: TwodbAdapterContext): Promise<TwodbToolRoundResult> {
  const response = await complete(request, ctx);
  const choice = response.choices[0];
  return {
    tool_calls: choice?.message.tool_calls ?? [],
    content: choice?.message.content ?? null,
    usage: response.usage,
  };
}

const ClaudeCodeAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.claude-code",
  displayName: "Claude Code (subscription)",
  models: MODELS,
  tools: {
    runToolRound,
  },
  completions: {
    complete,
    stream: streamCompletion,
  },
  usage: {
    ttlMs: 15 * 60_000,
    fetch: async () => {
      throw new Error("not_implemented");
    },
  },
};

const ClaudeCodeServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", ClaudeCodeAdapter);
  },
} satisfies ServicePlugin;

export default ClaudeCodeServicePlugin;
