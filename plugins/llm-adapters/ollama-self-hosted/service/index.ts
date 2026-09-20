import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { OllamaSelfHostedConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type OpenAiClientOptions } from "./openai-client";

const MODELS: TwodbModelInfo[] = [];

const DEFAULT_BASE_URL = "http://localhost:11434";

function clientOptions(ctx: TwodbAdapterContext): OpenAiClientOptions {
  const config = ctx.config as Partial<OllamaSelfHostedConnectionConfig>;
  return { url: resolveChatCompletionsUrl(config.base_url ?? "", DEFAULT_BASE_URL) };
}

const OllamaSelfHostedAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.ollama-self-hosted",
  displayName: "Ollama (self-hosted)",
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

const OllamaSelfHostedServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", OllamaSelfHostedAdapter);
  },
} satisfies ServicePlugin;

export default OllamaSelfHostedServicePlugin;
