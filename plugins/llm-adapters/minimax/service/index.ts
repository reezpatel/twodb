import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type {
  TwodbAdapterContext,
  TwodbCompletionRequest,
  TwodbCompletionResponse,
  TwodbContentPart,
  TwodbFinishReason,
  TwodbLlmProviderAdapter,
  TwodbMessage,
  TwodbModelInfo,
  TwodbStreamDelta,
  TwodbStreamEvent,
  TwodbTool,
  TwodbToolRoundResult,
  TwodbUsage,
} from "@twodb/contracts";
import type { MinimaxConnectionConfig } from "../shared/api";
import { postChatCompletion, streamChatCompletion, type OpenAiChatRequest, type OpenAiMessage } from "./openai";

const MODELS: TwodbModelInfo[] = [
  {
    id: "minimax-m2",
    display_name: "MiniMax-M2",
    context_window: 204000,
    max_output_tokens: 32000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true },
    knowledge_cutoff: "2025-08",
  },
  {
    id: "minimax-m2.1",
    display_name: "MiniMax-M2.1",
    context_window: 204000,
    max_output_tokens: 32000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true },
    knowledge_cutoff: "2025-09",
  },
];

const CHAT_COMPLETIONS_URL = "https://api.minimax.io/v1/chat/completions";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function apiKeyOf(ctx: TwodbAdapterContext): string {
  const config = ctx.config as Partial<MinimaxConnectionConfig>;
  const apiKey = String(config.api_key ?? "").trim();
  if (!apiKey) {
    throw new Error("MiniMax is not configured: missing api key");
  }
  return apiKey;
}

function textOf(content: string | TwodbContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function toOpenAiMessages(messages: TwodbMessage[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  for (const message of messages) {
    switch (message.role) {
      case "system":
        out.push({ role: "system", content: message.content });
        break;
      case "user":
        out.push({ role: "user", content: textOf(message.content) });
        break;
      case "assistant":
        out.push({
          role: "assistant",
          content: message.content ?? "",
          ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
        });
        break;
      case "tool":
        out.push({
          role: "tool",
          content: message.content,
          tool_call_id: message.tool_call_id,
          ...(message.name ? { name: message.name } : {}),
        });
        break;
    }
  }
  return out;
}

function toOpenAiRequest(request: TwodbCompletionRequest): OpenAiChatRequest {
  const model = MODELS.find((entry) => entry.id === request.model);
  return {
    model: request.model,
    messages: toOpenAiMessages(request.messages),
    ...(request.tools?.length ? { tools: request.tools, tool_choice: request.tool_choice } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.top_p !== undefined ? { top_p: request.top_p } : {}),
    max_tokens: request.max_tokens ?? model?.max_output_tokens ?? 16384,
    ...(request.stop?.length ? { stop: request.stop } : {}),
  };
}

function toFinishReason(reason: string | null | undefined): TwodbFinishReason {
  switch (reason) {
    case "tool_calls":
    case "function_call":
      return "tool_calls";
    case "length":
      return "length";
    case "content_filter":
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
  const details = asRecord(usage?.["prompt_tokens_details"]);
  const cached = details ? usageNumber(details, "cached_tokens") : 0;
  return {
    input_tokens: usageNumber(usage, "prompt_tokens"),
    output_tokens: usageNumber(usage, "completion_tokens"),
    ...(cached ? { cached_input_tokens: cached } : {}),
  };
}

async function completeImpl(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): Promise<TwodbCompletionResponse> {
  const apiKey = apiKeyOf(ctx);
  const response = await postChatCompletion(CHAT_COMPLETIONS_URL, apiKey, toOpenAiRequest(request));
  const choice = response.choices?.[0];
  const message = asRecord(choice?.message) ?? {};
  const rawCalls = Array.isArray(message["tool_calls"]) ? message["tool_calls"] : [];
  const toolCalls = rawCalls.map((raw) => {
    const call = asRecord(raw) ?? {};
    const fn = asRecord(call["function"]) ?? {};
    return {
      id: String(call["id"] ?? ""),
      type: "function" as const,
      function: {
        name: String(fn["name"] ?? ""),
        arguments: String(fn["arguments"] ?? "{}"),
      },
    };
  });
  const content = typeof message["content"] === "string" ? message["content"] : null;
  return {
    id: response.id ?? `chatcmpl-${crypto.randomUUID()}`,
    model: response.model ?? request.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: toFinishReason(choice?.finish_reason),
      },
    ],
    usage: toUsage(response.usage),
  };
}

async function* streamImpl(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): AsyncGenerator<TwodbStreamEvent> {
  let started = false;
  let finishReason: string | null | undefined;
  let usage: Record<string, unknown> | undefined;

  try {
    const apiKey = apiKeyOf(ctx);
    for await (const chunk of streamChatCompletion(CHAT_COMPLETIONS_URL, apiKey, toOpenAiRequest(request))) {
      if (chunk.usage) usage = chunk.usage;
      if (!started) {
        started = true;
        yield {
          type: "start",
          id: chunk.id ?? `chatcmpl-${crypto.randomUUID()}`,
          model: chunk.model ?? request.model,
        };
      }
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = asRecord(choice.delta) ?? {};
      const out: TwodbStreamDelta = {};
      if (typeof delta["content"] === "string" && delta["content"]) {
        out.content = delta["content"];
      }
      if (typeof delta["reasoning_content"] === "string" && delta["reasoning_content"]) {
        out.reasoning = delta["reasoning_content"];
      }
      const rawCalls = Array.isArray(delta["tool_calls"]) ? delta["tool_calls"] : [];
      if (rawCalls.length) {
        out.tool_calls = rawCalls.map((raw) => {
          const call = asRecord(raw) ?? {};
          const fn = asRecord(call["function"]) ?? {};
          const index = call["index"];
          return {
            index: typeof index === "number" ? index : 0,
            id: String(call["id"] ?? ""),
            type: "function" as const,
            function: {
              name: String(fn["name"] ?? ""),
              arguments: String(fn["arguments"] ?? ""),
            },
          };
        });
      }
      if (Object.keys(out).length) {
        yield { type: "chunk", index: 0, delta: out };
      }
    }
    if (!started) {
      yield {
        type: "start",
        id: `chatcmpl-${crypto.randomUUID()}`,
        model: request.model,
      };
    }
    yield { type: "finish", index: 0, finish_reason: toFinishReason(finishReason) };
    yield { type: "usage", usage: toUsage(usage) };
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

const MinimaxAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.minimax",
  displayName: "MiniMax",
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

const MinimaxServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", MinimaxAdapter);
  },
} satisfies ServicePlugin;

export default MinimaxServicePlugin;
