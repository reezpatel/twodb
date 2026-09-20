import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { XaiConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type XaiClientOptions } from "./xai-client";

const MODELS: TwodbModelInfo[] = [
  {
    id: "grok-4.1",
    display_name: "Grok 4.1",
    context_window: 256_000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: {
      images: true,
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
  {
    id: "grok-4.1-fast",
    display_name: "Grok 4.1 Fast",
    context_window: 2_000_000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "low" },
    supports: {
      images: true,
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
  {
    id: "grok-code-fast-1",
    display_name: "Grok Code Fast 1",
    context_window: 256_000,
    supports: {
      tool_calling: true,
      streaming: true,
      system_prompt: true,
    },
  },
];

const DEFAULT_BASE_URL = "https://api.x.ai/v1";

function clientOptions(ctx: TwodbAdapterContext): XaiClientOptions {
  const config = ctx.config as Partial<XaiConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  if (!apiKey) throw new Error("xAI connection is missing an api key");
  return {
    url: resolveChatCompletionsUrl("", DEFAULT_BASE_URL),
    apiKey,
  };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const XaiAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.xai",
  displayName: "xAI",
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

const XaiServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", XaiAdapter);
  },
} satisfies ServicePlugin;

export default XaiServicePlugin;
