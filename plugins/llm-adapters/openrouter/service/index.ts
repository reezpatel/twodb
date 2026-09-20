import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type {
  TwodbAdapterContext,
  TwodbCompletionResponse,
  TwodbLlmProviderAdapter,
  TwodbModelInfo,
  TwodbToolRoundResult,
  TwodbUsageSnapshot,
} from "@twodb/contracts";
import type { OpenRouterConnectionConfig } from "../shared/api";
import { completeChatCompletion, resolveChatCompletionsUrl, streamChatCompletion, type OpenAiClientOptions } from "./openai-client";

const MODELS: TwodbModelInfo[] = [];

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const CREDITS_TIMEOUT_MS = 15_000;

function clientOptions(ctx: TwodbAdapterContext): OpenAiClientOptions {
  const config = ctx.config as Partial<OpenRouterConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  if (!apiKey) throw new Error("OpenRouter connection is missing an api key");
  return {
    url: resolveChatCompletionsUrl(config.base_url ?? "", DEFAULT_BASE_URL),
    apiKey,
  };
}

function sanitizeError(text: string, maxLength = 200): string {
  const sanitized = text.replace(/\s+/g, " ").trim();
  return (sanitized || "unknown").slice(0, maxLength);
}

function resolveCreditsUrl(baseUrl: string): string {
  const trimmed = (baseUrl.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return /\/v\d+$/.test(trimmed) ? `${trimmed}/credits` : `${trimmed}/v1/credits`;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function fetchUsage(ctx: TwodbAdapterContext): Promise<TwodbUsageSnapshot> {
  const config = ctx.config as Partial<OpenRouterConnectionConfig>;
  const apiKey = (config.api_key ?? "").trim();
  if (!apiKey) throw new Error("OpenRouter connection is missing an api key");

  const response = await fetch(resolveCreditsUrl(config.base_url ?? ""), {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(CREDITS_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter credits error ${response.status}: ${sanitizeError(text)}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`OpenRouter credits returned invalid JSON: ${sanitizeError(text)}`);
  }
  const credits = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as { data?: unknown }).data : undefined;
  const record =
    credits && typeof credits === "object" && !Array.isArray(credits) ? (credits as { total_credits?: unknown; total_usage?: unknown }) : undefined;
  const totalCredits = finiteNumber(record?.total_credits);
  const totalUsage = finiteNumber(record?.total_usage);

  return {
    kind: "cost",
    balance: {
      amount: totalCredits !== undefined && totalUsage !== undefined ? totalCredits - totalUsage : null,
      currency: "USD",
      as_of: new Date().toISOString(),
    },
  };
}

const OpenRouterAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.openrouter",
  displayName: "OpenRouter",
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
    fetch: fetchUsage,
  },
};

const OpenRouterServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", OpenRouterAdapter);
  },
} satisfies ServicePlugin;

export default OpenRouterServicePlugin;
