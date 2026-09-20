import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { MistralConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type MistralClientOptions } from "./mistral-client";

const MODELS: TwodbModelInfo[] = [
  {
    id: "mistral-large-latest",
    display_name: "Mistral Large",
    context_window: 131_000,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
  },
  {
    id: "codestral-latest",
    display_name: "Codestral",
    context_window: 256_000,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
  },
  {
    id: "mistral-small-latest",
    display_name: "Mistral Small",
    context_window: 131_000,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
];

const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";

function clientOptions(ctx: TwodbAdapterContext): MistralClientOptions {
  const config = ctx.config as Partial<MistralConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  if (!apiKey) throw new Error("Mistral connection is missing an api key");
  return {
    url: resolveChatCompletionsUrl("", DEFAULT_BASE_URL),
    apiKey,
  };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const MistralAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.mistral",
  displayName: "Mistral",
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

const MistralServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", MistralAdapter);
  },
} satisfies ServicePlugin;

export default MistralServicePlugin;
