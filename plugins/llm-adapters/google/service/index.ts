import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type {
  TwodbAdapterContext,
  TwodbCompletionRequest,
  TwodbCompletionResponse,
  TwodbLlmProviderAdapter,
  TwodbModelInfo,
  TwodbStreamEvent,
  TwodbTool,
  TwodbToolRoundResult,
} from "@twodb/contracts";
import type { GoogleConnectionConfig } from "../shared/api";
import { completeGenerateContent, streamGenerateContent, type GeminiClientOptions } from "./gemini-client";

const MODELS: TwodbModelInfo[] = [
  {
    id: "gemini-3-pro",
    display_name: "Gemini 3 Pro",
    context_window: 1_048_576,
    max_output_tokens: 65_536,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "high" },
    supports: {
      images: true,
      audio: true,
      video: true,
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
    knowledge_cutoff: "2025-01",
  },
  {
    id: "gemini-3-flash",
    display_name: "Gemini 3 Flash",
    context_window: 1_048_576,
    max_output_tokens: 65_536,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: {
      images: true,
      audio: true,
      video: true,
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
    knowledge_cutoff: "2025-01",
  },
  {
    id: "gemini-2.5-flash-lite",
    display_name: "Gemini 2.5 Flash-Lite",
    context_window: 1_048_576,
    max_output_tokens: 65_536,
    thinking: { supported: true, levels: ["off", "low", "medium"], default: "off" },
    supports: {
      images: true,
      audio: true,
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
    knowledge_cutoff: "2024-12",
  },
];

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function clientOptionsFor(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): GeminiClientOptions {
  const config = ctx.config as Partial<GoogleConnectionConfig>;
  const apiKey = String(config.api_key ?? "").trim();
  if (!apiKey) throw new Error("Google Gemini connection is missing an api key");
  const model = MODELS.find((entry) => entry.id === request.model);
  return { baseUrl: DEFAULT_BASE_URL, apiKey, modelMaxOutputTokens: model?.max_output_tokens };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

async function completeImpl(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): Promise<TwodbCompletionResponse> {
  return completeGenerateContent(request, clientOptionsFor(request, ctx));
}

function streamImpl(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): AsyncIterable<TwodbStreamEvent> {
  return streamGenerateContent(request, clientOptionsFor(request, ctx));
}

async function runToolRoundImpl(request: TwodbCompletionRequest & { tools: TwodbTool[] }, ctx: TwodbAdapterContext): Promise<TwodbToolRoundResult> {
  const response = await completeImpl(request, ctx);
  const choice = response.choices[0];
  return {
    tool_calls: choice.message.tool_calls ?? [],
    content: choice.message.content,
    ...(response.usage ? { usage: response.usage } : {}),
  };
}

const GoogleAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.google",
  displayName: "Google Gemini",
  models: MODELS,
  tools: {
    runToolRound: runToolRoundImpl,
  },
  completions: {
    complete: completeImpl,
    stream: streamImpl,
  },
};

const GoogleServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", GoogleAdapter);
  },
} satisfies ServicePlugin;

export default GoogleServicePlugin;
