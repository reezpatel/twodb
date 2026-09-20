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
  TwodbToolChoice,
  TwodbToolRoundResult,
  TwodbUsage,
} from "@twodb/contracts";
import type { ZaiConnectionConfig } from "../shared/api";
import {
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
    id: "glm-4.7",
    display_name: "GLM-4.7",
    context_window: 200000,
    max_output_tokens: 32000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true },
    knowledge_cutoff: "2025-09",
  },
  {
    id: "glm-4.7-air",
    display_name: "GLM-4.7 Air",
    context_window: 129000,
    max_output_tokens: 16000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "low" },
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true },
    knowledge_cutoff: "2025-09",
  },
];

const MESSAGES_URL = "https://api.z.ai/api/coding/paas/v4/messages";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function apiKeyOf(ctx: TwodbAdapterContext): string {
  const config = ctx.config as Partial<ZaiConnectionConfig>;
  const apiKey = String(config.api_key ?? "").trim();
  if (!apiKey) {
    throw new Error("Z.ai (GLM) is not configured: missing api key");
  }
  return apiKey;
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
  const apiKey = apiKeyOf(ctx);
  const response = await postAnthropicMessages(MESSAGES_URL, apiKey, toAnthropicRequest(request));
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
    const apiKey = apiKeyOf(ctx);
    for await (const event of streamAnthropicMessages(MESSAGES_URL, apiKey, toAnthropicRequest(request))) {
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

const ZaiAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.zai",
  displayName: "Z.ai (GLM)",
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
    fetch: async (): Promise<never> => {
      throw new Error("not_implemented");
    },
  },
};

const ZaiServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", ZaiAdapter);
  },
} satisfies ServicePlugin;

export default ZaiServicePlugin;
