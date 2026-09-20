import type { TwodbCompletionRequest, TwodbCompletionResponse, TwodbLlmProviderAdapter, TwodbStreamEvent } from "@twodb/contracts";

declare module "@twodb/shared-backend" {
  interface TwodbFn {
    "llm.register": (adapter: TwodbLlmProviderAdapter) => void;
    "llm.adapters": () => TwodbLlmProviderAdapter[];
    "llm.adapter": (providerId: string) => TwodbLlmProviderAdapter | null;
    "llm.complete": (input: { workspaceId: string; connectionId?: string | null; request: TwodbCompletionRequest }) => Promise<TwodbCompletionResponse>;
    "llm.stream": (input: { workspaceId: string; connectionId?: string | null; request: TwodbCompletionRequest }) => Promise<AsyncIterable<TwodbStreamEvent>>;
  }
}
