import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbAdapterContext, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbModelInfo, TwodbToolRoundResult } from "@twodb/contracts";
import type { CloudflareAiGatewayConnectionConfig } from "../shared/api";
import { buildGatewayUrl, completeChatCompletion, streamChatCompletion, type GatewayClientOptions } from "./gateway-client";

const MODELS: TwodbModelInfo[] = [];

function clientOptions(ctx: TwodbAdapterContext): GatewayClientOptions {
  const config = ctx.config as Partial<CloudflareAiGatewayConnectionConfig>;
  const accountId = (config.account_id ?? "").trim();
  const gatewayId = (config.gateway_id ?? "").trim();
  if (!accountId) throw new Error("Cloudflare AI Gateway connection is missing an account id");
  if (!gatewayId) throw new Error("Cloudflare AI Gateway connection is missing a gateway id");
  return {
    url: buildGatewayUrl(accountId, gatewayId),
    apiKey: (config.api_key ?? "").trim(),
  };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const CloudflareAiGatewayAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.cloudflare-ai-gateway",
  displayName: "Cloudflare AI Gateway",
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

const CloudflareAiGatewayServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", CloudflareAiGatewayAdapter);
  },
} satisfies ServicePlugin;

export default CloudflareAiGatewayServicePlugin;
