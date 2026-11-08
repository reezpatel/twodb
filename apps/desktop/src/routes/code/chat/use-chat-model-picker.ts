import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { api } from "@/lib/api";
import { fmtTokens } from "@/lib/format-tokens";
import type { LlmModel } from "@/lib/llm";
import type { ModelConfig } from "@/components/model-picker/use-model-config";
import type { ModelProvider } from "@twodb/blocks";

const pickerId = (connectionId: string, modelId: string) => `${connectionId}::${modelId}`;

export interface BlocksModelPickerProps {
  providers: ModelProvider[];
  /** pickerId of the active selection, or "" when nothing is selected. */
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}

/**
 * Adapts the session's connection / model selection to the @twodb/blocks
 * <ModelPicker>: every enabled connection is a provider tab, its models the
 * rows (identifier · context window · thinking badge).
 */
export function useChatModelPicker(config: ModelConfig): BlocksModelPickerProps {
  const { connections, selected, model, effectiveModel, selectConnectionModel } = config;

  const modelQueries = useQueries({
    queries: connections.map((connection) => ({
      queryKey: ["llm", "models", connection.id],
      queryFn: () => api<LlmModel[]>(`/api/llm/connections/${connection.id}/models`),
    })),
  });

  const { providers, targets } = useMemo(() => {
    const lookup = new Map<string, { connectionId: string; modelId: string }>();
    const list: ModelProvider[] = connections.map((connection, index) => ({
      id: connection.id,
      title: connection.name,
      icon: Bot,
      models: (modelQueries[index]?.data ?? []).map((item) => {
        const id = pickerId(connection.id, item.modelId);
        lookup.set(id, { connectionId: connection.id, modelId: item.modelId });
        return {
          id,
          label: item.displayName ?? item.modelId,
          context: item.contextWindow ? fmtTokens(item.contextWindow) : undefined,
          thinking: item.thinking,
        };
      }),
    }));
    return { providers: list, targets: lookup };
    // modelQueries is a fresh array each render; its data identities are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, ...modelQueries.map((query) => query.data)]);

  const value = selected ? pickerId(selected.id, model || effectiveModel) : "";

  return {
    providers,
    value,
    disabled: connections.length === 0,
    onChange: (id) => {
      const target = targets.get(id);
      if (target) selectConnectionModel(target.connectionId, target.modelId);
    },
  };
}
