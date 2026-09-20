import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { DeepSeekConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type DeepSeekClientOptions } from "./deepseek-client";

const MODELS: TwodbModelInfo[] = [
  {
    id: "deepseek-chat",
    display_name: "DeepSeek-V3.2",
    context_window: 164_000,
    max_output_tokens: 8_000,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
  },
  {
    id: "deepseek-reasoner",
    display_name: "DeepSeek-V3.2 Reasoner",
    context_window: 164_000,
    max_output_tokens: 64_000,
    thinking: { supported: true, levels: ["high"], default: "high" },
    supports: {
      tool_calling: true,
      streaming: true,
      system_prompt: true,
      prompt_caching: true,
    },
  },
];

const DEFAULT_BASE_URL = "https://api.deepseek.com";

function clientOptions(ctx: TwodbAdapterContext): DeepSeekClientOptions {
  const config = ctx.config as Partial<DeepSeekConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  if (!apiKey) throw new Error("DeepSeek connection is missing an api key");
  return {
    url: resolveChatCompletionsUrl("", DEFAULT_BASE_URL),
    apiKey,
  };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const DeepSeekAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.deepseek",
  displayName: "DeepSeek",
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
};

const DeepSeekServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", DeepSeekAdapter);
  },
} satisfies ServicePlugin;

export default DeepSeekServicePlugin;
