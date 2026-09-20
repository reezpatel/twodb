import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { OpenaiCompatibleConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type OpenAiClientOptions } from "./openai-client";

const MODELS: TwodbModelInfo[] = [];

function clientOptions(ctx: TwodbAdapterContext): OpenAiClientOptions {
  const config = ctx.config as Partial<OpenaiCompatibleConnectionConfig>;
  const baseUrl = (config.base_url ?? "").trim();
  if (!baseUrl) throw new Error("OpenAI-compatible connection is missing a base URL");
  return {
    url: resolveChatCompletionsUrl(baseUrl, ""),
    apiKey: (config.api_key ?? "").trim(),
  };
}

const OpenaiCompatibleAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.openai-compatible",
  displayName: "OpenAI-compatible",
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

const OpenaiCompatibleServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", OpenaiCompatibleAdapter);
  },
} satisfies ServicePlugin;

export default OpenaiCompatibleServicePlugin;
