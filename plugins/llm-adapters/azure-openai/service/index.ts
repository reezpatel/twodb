import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { AzureOpenAiConnectionConfig } from "../shared/api";
import { completeChatCompletion, streamChatCompletion, type AzureOpenAiClientOptions } from "./azure-client";

const MODELS: TwodbModelInfo[] = [];

const DEFAULT_API_VERSION = "2025-04-01-preview";

function clientOptions(ctx: TwodbAdapterContext): AzureOpenAiClientOptions {
  const config = ctx.config as Partial<AzureOpenAiConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  const baseUrl = (config.base_url ?? "").trim();
  if (!apiKey) throw new Error("Azure OpenAI connection is missing an api key");
  if (!baseUrl) throw new Error("Azure OpenAI connection is missing a base URL");
  return {
    baseUrl,
    apiKey,
    apiVersion: (config.api_version ?? "").trim() || DEFAULT_API_VERSION,
    deploymentMap: config.deployment_map ?? "",
  };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const AzureOpenAiAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.azure-openai",
  displayName: "Azure OpenAI",
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

const AzureOpenAiServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", AzureOpenAiAdapter);
  },
} satisfies ServicePlugin;

export default AzureOpenAiServicePlugin;
