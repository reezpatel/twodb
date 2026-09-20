import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { GroqConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type OpenAiClientOptions } from "./openai-client";

const MODELS: TwodbModelInfo[] = [
  {
    id: "llama-3.3-70b-versatile",
    display_name: "Llama 3.3 70B Versatile",
    context_window: 131_072,
    max_output_tokens: 32_768,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
  {
    id: "openai/gpt-oss-120b",
    display_name: "GPT-OSS 120B",
    context_window: 131_072,
    max_output_tokens: 65_536,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
  {
    id: "qwen/qwen3-32b",
    display_name: "Qwen3 32B",
    context_window: 131_072,
    supports: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
    },
  },
];

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

function clientOptions(ctx: TwodbAdapterContext): OpenAiClientOptions {
  const config = ctx.config as Partial<GroqConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  if (!apiKey) throw new Error("Groq connection is missing an api key");
  return {
    url: resolveChatCompletionsUrl("", DEFAULT_BASE_URL),
    apiKey,
  };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const GroqAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.groq",
  displayName: "Groq",
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

const GroqServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", GroqAdapter);
  },
} satisfies ServicePlugin;

export default GroqServicePlugin;
