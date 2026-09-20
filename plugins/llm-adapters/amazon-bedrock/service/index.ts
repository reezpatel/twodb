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
import type { BedrockConnectionConfig } from "../shared/api";
import { mapAnthropicStream, toBedrockAnthropicRequest, toTwodbResponse } from "./anthropic";
import { bedrockComplete, bedrockStream, type BedrockInvokeOptions } from "./bedrock-client";
import { assertBedrockRegion, type AwsCredentials } from "./sigv4";

const MODELS: TwodbModelInfo[] = [
  {
    id: "us.anthropic.claude-sonnet-4.6",
    display_name: "Claude Sonnet 4.6 (US)",
    context_window: 200_000,
    max_output_tokens: 64_000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: {
      images: true,
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
  },
  {
    id: "us.anthropic.claude-haiku-4.5",
    display_name: "Claude Haiku 4.5 (US)",
    context_window: 200_000,
    max_output_tokens: 32_768,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "low" },
    supports: {
      images: true,
      tool_calling: true,
      streaming: true,
      json_mode: true,
      system_prompt: true,
      prompt_caching: true,
    },
  },
];

const DEFAULT_MAX_TOKENS = 4096;

function invokeOptionsOf(ctx: TwodbAdapterContext): BedrockInvokeOptions {
  const config = ctx.config as Partial<BedrockConnectionConfig>;
  const region = String(config.region ?? "").trim();
  const accessKeyId = String(config.access_key_id ?? "").trim();
  const secretAccessKey = String(config.secret_access_key ?? "").trim();
  const sessionToken = String(config.session_token ?? "").trim();
  if (!region) throw new Error("Amazon Bedrock connection is missing a region");
  if (!accessKeyId) throw new Error("Amazon Bedrock connection is missing an access key id");
  if (!secretAccessKey) throw new Error("Amazon Bedrock connection is missing a secret access key");
  assertBedrockRegion(region);
  const credentials: AwsCredentials = {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
  return { region, credentials };
}

const notImplementedUsage = async (): Promise<never> => {
  throw new Error("not_implemented");
};

async function completeImpl(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): Promise<TwodbCompletionResponse> {
  const response = await bedrockComplete(invokeOptionsOf(ctx), request.model, toBedrockAnthropicRequest(request, DEFAULT_MAX_TOKENS));
  return toTwodbResponse(request, response);
}

function streamImpl(request: TwodbCompletionRequest, ctx: TwodbAdapterContext): AsyncIterable<TwodbStreamEvent> {
  return mapAnthropicStream(bedrockStream(invokeOptionsOf(ctx), request.model, toBedrockAnthropicRequest(request, DEFAULT_MAX_TOKENS)), request.model);
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

const BedrockAdapter: TwodbLlmProviderAdapter = {
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplementedUsage,
  },
  providerId: "io.twodb.llm.amazon-bedrock",
  displayName: "Amazon Bedrock",
  models: MODELS,
  tools: {
    runToolRound: runToolRoundImpl,
  },
  completions: {
    complete: completeImpl,
    stream: streamImpl,
  },
};

const BedrockServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", BedrockAdapter);
  },
} satisfies ServicePlugin;

export default BedrockServicePlugin;
