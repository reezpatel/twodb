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
import type { GoogleVertexConnectionConfig } from "../shared/api";
import { completeGenerateContent, streamGenerateContent, type VertexClientOptions } from "./gemini-client";

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

function clientOptionsFor(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): VertexClientOptions {
  const config = ctx.config as Partial<GoogleVertexConnectionConfig>;
  const project = String(config.project ?? "").trim();
  const location = String(config.location ?? "").trim();
  const serviceAccountJson = String(config.service_account_json ?? "").trim();
  if (!project) throw new Error("Vertex AI connection is missing a project id");
  if (!location) throw new Error("Vertex AI connection is missing a location");
  if (!serviceAccountJson) throw new Error("Vertex AI connection is missing a service account JSON key");
  const model = MODELS.find((entry) => entry.id === request.model);
  return { project, location, serviceAccountJson, modelMaxOutputTokens: model?.max_output_tokens };
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

const GoogleVertexAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.google-vertex",
  displayName: "Google Vertex AI",
  models: MODELS,
  tools: {
    runToolRound: runToolRoundImpl,
  },
  completions: {
    complete: completeImpl,
    stream: streamImpl,
  },
};

const GoogleVertexServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", GoogleVertexAdapter);
  },
} satisfies ServicePlugin;

export default GoogleVertexServicePlugin;
