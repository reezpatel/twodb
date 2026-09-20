import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { FireworksConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type OpenAiClientOptions } from "./openai-client";

const MODELS: TwodbModelInfo[] = [
  {
    id: "accounts/fireworks/models/kimi-k2-instruct",
    display_name: "Kimi K2 Instruct",
    context_window: 256_000,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
  {
    id: "accounts/fireworks/models/deepseek-v3",
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
    id: "accounts/fireworks/models/qwen3-coder",
    display_name: "Qwen3 Coder",
    context_window: 262_144,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
];

const DEFAULT_BASE_URL = "https://api.fireworks.ai/inference/v1";

function clientOptions(ctx: TwodbAdapterContext): OpenAiClientOptions {
  const config = ctx.config as Partial<FireworksConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  if (!apiKey) throw new Error("Fireworks connection is missing an api key");
  return {
    url: resolveChatCompletionsUrl("", DEFAULT_BASE_URL),
    apiKey,
  };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const FireworksAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.fireworks",
  displayName: "Fireworks",
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

const FireworksServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", FireworksAdapter);
  },
} satisfies ServicePlugin;

export default FireworksServicePlugin;
