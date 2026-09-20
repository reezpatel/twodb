import type { FastifyInstance } from "fastify";
import type { ServicePlugin, TwodbContext } from "@twodb/shared-backend";
import type {} from "@twodb/llm/shared/fn";
import type { TwodbLlmProviderAdapter, TwodbModelInfo } from "@twodb/contracts";

const MODELS: TwodbModelInfo[] = [
  {
    id: "gpt-5.2-codex",
    display_name: "GPT-5.2 Codex",
    context_window: 400000,
    max_output_tokens: 128000,
    thinking: { supported: true, levels: ["off", "low", "medium", "high"], default: "medium" },
    supports: { images: true, system_prompt: true, tool_calling: true, streaming: true, json_mode: true, prompt_caching: true },
    knowledge_cutoff: "2025-09",
  },
  {
    id: "gpt-5.2-codex-mini",
    display_name: "GPT-5.2 Codex mini",
    context_window: 272000,
    max_output_tokens: 128000,
    thinking: { supported: true, levels: ["low", "medium", "high"], default: "low" },
    supports: { system_prompt: true, tool_calling: true, streaming: true, json_mode: true, prompt_caching: true },
    knowledge_cutoff: "2025-09",
  },
];

const notImplemented = async (): Promise<never> => {
  throw new Error("not_implemented");
};

const CodexAdapter: TwodbLlmProviderAdapter = {
  providerId: "io.twodb.llm.codex",
  displayName: "OpenAI Codex",
  models: MODELS,
  tools: {
    runToolRound: notImplemented,
  },
  completions: {
    complete: notImplemented,
    async *stream() {
      yield { type: "error", error: "not_implemented" };
    },
  },
  usage: {
    ttlMs: 15 * 60_000,
    fetch: notImplemented,
  },
};

const CodexServicePlugin = {
  init: async (_ctx: TwodbContext, app: FastifyInstance) => {
    app.invoke("llm.register", CodexAdapter);
  },
} satisfies ServicePlugin;

export default CodexServicePlugin;
