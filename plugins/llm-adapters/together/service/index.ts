import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { TogetherConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type OpenAiClientOptions } from "./openai-client";

const MODELS: TwodbModelInfo[] = [
  {
    id: "deepseek-ai/DeepSeek-V3",
    display_name: "DeepSeek V3",
    context_window: 131_072,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
  {
    id: "Qwen/Qwen3-Coder-4807B-A35B-Instruct",
    display_name: "Qwen3 Coder 4807B A35B Instruct",
    context_window: 262_144,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
  {
    id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    display_name: "Llama 3.3 70B Instruct Turbo",
    context_window: 131_072,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
];

const DEFAULT_BASE_URL = "https://api.together.xyz/v1";

function clientOptions(ctx: TwodbAdapterContext): OpenAiClientOptions {
  const config = ctx.config as Partial<TogetherConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  if (!apiKey) throw new Error("Together connection is missing an api key");
  return {
    url: resolveChatCompletionsUrl("", DEFAULT_BASE_URL),
    apiKey,
  };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const TogetherAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.together",
  displayName: "Together",
  models: MODELS,
  tools: {
    runToolRound: async (request, ctx): Promise<TwodbToolRoundResult> => {
      const response: TwodbCompletionResponse = await completeChatCompletion(request, clientOptions(ctx));
      const message = response.choices[0]?.message;
      return {
        tool_calls: message?.tool_calls ?? [],
        content: message?.content ?? null,
        ...(response.usage ? { usage: response.usage } : {}),
      };
    },
  },
  completions: {
    complete: (request, ctx) => completeChatCompletion(request, clientOptions(ctx)),
    stream: (request, ctx) => streamChatCompletion(request, clientOptions(ctx)),
  },
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
};

const TogetherServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", TogetherAdapter);
  },
} satisfies ServicePlugin;

export default TogetherServicePlugin;
