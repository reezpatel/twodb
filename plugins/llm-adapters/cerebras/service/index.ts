import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { CerebrasConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type CerebrasClientOptions } from "./cerebras-client";

const MODELS: TwodbModelInfo[] = [
  {
    id: "llama-3.3-70b",
    display_name: "Llama 3.3 70B",
    context_window: 131_000,
    supports: {
      tool_calling: true,
      streaming: true,
      system_prompt: true,
    },
  },
  {
    id: "qwen-3-coder-480b",
    display_name: "Qwen 3 Coder 480B",
    context_window: 131_000,
    supports: {
      tool_calling: true,
      streaming: true,
      system_prompt: true,
    },
  },
  {
    id: "gpt-oss-120b",
    display_name: "GPT-OSS 120B",
    context_window: 131_000,
    thinking: { supported: true, levels: ["low", "medium", "high"], default: "medium" },
    supports: {
      tool_calling: true,
      streaming: true,
      system_prompt: true,
    },
  },
];

const DEFAULT_BASE_URL = "https://api.cerebras.ai/v1";

function clientOptions(ctx: TwodbAdapterContext): CerebrasClientOptions {
  const config = ctx.config as Partial<CerebrasConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  if (!apiKey) throw new Error("Cerebras connection is missing an api key");
  return {
    url: resolveChatCompletionsUrl("", DEFAULT_BASE_URL),
    apiKey,
  };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const CerebrasAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.cerebras",
  displayName: "Cerebras",
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

const CerebrasServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", CerebrasAdapter);
  },
} satisfies ServicePlugin;

export default CerebrasServicePlugin;
