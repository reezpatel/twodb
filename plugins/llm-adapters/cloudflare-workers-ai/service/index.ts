import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { CloudflareWorkersAiConnectionConfig } from "../shared/api";
import { completeWorkersAi, streamWorkersAi, type WorkersAiClientOptions } from "./workers-ai-client";

const MODELS: TwodbModelInfo[] = [
  {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    display_name: "Llama 3.3 70B Instruct FP8 Fast",
    context_window: 131_072,
    supports: {
      streaming: true,
      system_prompt: true,
      tool_calling: false,
    },
  },
  {
    id: "@cf/qwen/qwen2.5-coder-32b-instruct",
    display_name: "Qwen2.5 Coder 32B Instruct",
    context_window: 32_768,
    supports: {
      streaming: true,
      system_prompt: true,
      tool_calling: false,
    },
  },
  {
    id: "@cf/openai/gpt-oss-120b",
    display_name: "GPT-OSS 120B",
    context_window: 131_072,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: {
      streaming: true,
      system_prompt: true,
      tool_calling: false,
    },
  },
];

function clientOptions(ctx: TwodbAdapterContext): WorkersAiClientOptions {
  const config = ctx.config as Partial<CloudflareWorkersAiConnectionConfig>;
  const accountId = (config.account_id ?? "").trim();
  const apiToken = (config.api_token ?? "").trim();
  if (!accountId) throw new Error("Cloudflare Workers AI connection is missing an account id");
  if (!apiToken) throw new Error("Cloudflare Workers AI connection is missing an api token");
  return { accountId, apiToken };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const CloudflareWorkersAiAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.cloudflare-workers-ai",
  displayName: "Cloudflare Workers AI",
  models: MODELS,
  tools: {
    runToolRound: async (): Promise<TwodbToolRoundResult> => {
      throw new Error("not_implemented");
    },
  },
  completions: {
    complete: (request, ctx) => completeWorkersAi(request, clientOptions(ctx)),
    stream: (request, ctx) => streamWorkersAi(request, clientOptions(ctx)),
  },
};

const CloudflareWorkersAiServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", CloudflareWorkersAiAdapter);
  },
} satisfies ServicePlugin;

export default CloudflareWorkersAiServicePlugin;
