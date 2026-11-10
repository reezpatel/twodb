import type { LlmProvider } from "./types.js";
import { openAiCompatibleProvider, anthropicProvider, responsesProvider } from "./wires.js";
import { getProviderSpec } from "./catalog.js";

export * from "./types.js";
export * from "./catalog.js";

/**
 * Provider lookup is catalog-driven: the catalog's `api` field picks the
 * wire adapter. Legacy had a per-provider registry; one entry per wire is
 * all that actually varies.
 */
export function getProvider(kind: string): LlmProvider {
  const spec = getProviderSpec(kind);
  if (!spec) throw new Error(`unknown LLM provider: ${kind}`);
  switch (spec.api) {
    case "openai":
      return openAiCompatibleProvider;
    case "anthropic":
      return anthropicProvider;
    case "responses":
      return responsesProvider;
  }
}
