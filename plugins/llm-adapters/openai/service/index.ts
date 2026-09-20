import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { OpenAiConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type OpenAiClientOptions } from "./openai-client";

const MODELS: TwodbModelInfo[] = [
  {
    id: "gpt-5.2",
    display_name: "GPT-5.2",
    context_window: 400_000,
    max_output_tokens: 128_000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: {
      images: true,
      audio: true,
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
    knowledge_cutoff: "2025-09",
  },
  {
    id: "gpt-5.2-mini",
    display_name: "GPT-5.2 mini",
    context_window: 272_000,
    max_output_tokens: 128_000,
    thinking: { supported: true, levels: ["off", "low", "medium"], default: "low" },
    supports: {
      images: true,
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
    knowledge_cutoff: "2025-09",
  },
  {
    id: "gpt-5.1",
    display_name: "GPT-5.1",
    context_window: 400_000,
    max_output_tokens: 128_000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: {
      images: true,
      audio: true,
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
    knowledge_cutoff: "2025-06",
  },
];

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function clientOptions(ctx: TwodbAdapterContext): OpenAiClientOptions {
  const config = ctx.config as Partial<OpenAiConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  if (!apiKey) throw new Error("OpenAI connection is missing an api key");
  return {
    url: resolveChatCompletionsUrl(config.base_url ?? "", DEFAULT_BASE_URL),
    apiKey,
    org: (config.org ?? "").trim(),
  };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const OpenAiAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.openai",
  displayName: "OpenAI",
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

const OpenAiServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", OpenAiAdapter);
  },
} satisfies ServicePlugin;

export default OpenAiServicePlugin;
