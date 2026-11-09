import type { LlmProvider } from "./types.js";
import { openAiCompatibleProvider } from "./openai-compatible.js";
import { anthropicProvider } from "./anthropic.js";

export * from "./types.js";

const registry: Record<string, LlmProvider> = {
  "openai-compatible": openAiCompatibleProvider,
  anthropic: anthropicProvider,
};

export function getProvider(kind: string): LlmProvider {
  const provider = registry[kind];
  if (!provider) throw new Error(`unknown LLM provider kind: ${kind}`);
  return provider;
}
