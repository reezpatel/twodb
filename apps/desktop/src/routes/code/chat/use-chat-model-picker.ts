import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { api } from "@/lib/api";
import { fmtTokens } from "@/lib/format-tokens";
import type { LlmModel } from "@/lib/llm";
import { THINKING_ORDER, type ModelConfig } from "@/components/model-picker/use-model-config";
import type { ModelProvider } from "@twodb/blocks";

const pickerId = (connectionId: string, modelId: string) => `${connectionId}::${modelId}`;

/** Thinking levels a model supports, narrowed to the wire vocabulary. */
function levelsFor(model: LlmModel): string[] {
  if (!model.thinking) return [];
  const supported = model.thinkingLevel.length > 0 ? THINKING_ORDER.filter((level) => model.thinkingLevel.includes(level)) : THINKING_ORDER;
  return supported.length >= 2 ? supported : THINKING_ORDER;
}

export interface BlocksModelPickerProps {
  providers: ModelProvider[];
  /** pickerId of the active selection, or "" when nothing is selected. */
  value: string;
  disabled: boolean;
  thinkingLevel: string;
  onChange: (id: string) => void;
  onThinkingChange: (level: string) => void;
}

/**
 * Adapts the session's connection / model / thinking selection to the @twodb/blocks
 * <ModelPicker>: every enabled connection is a provider tab, its models the rows
 * (identifier · context window · thinking badge), plus the thinking-level effort.
 */
export function useChatModelPicker(config: ModelConfig): BlocksModelPickerProps {
  const { connections, selected, model, effectiveModel, thinkingLevel, selectConnectionModel, changeThinking } = config;

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
        const levels = levelsFor(item);
        return {
          id,
          label: item.displayName ?? item.modelId,
          context: item.contextWindow ? fmtTokens(item.contextWindow) : undefined,
          thinking: item.thinking,
          thinkingLevels: levels.length > 0 ? levels : undefined,
        };
      }),
    }));
    return { providers: list, targets: lookup };
    // modelQueries is a fresh array each render; its data identities are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, ...modelQueries.map((query) => query.data)]);

  // `selected`/`effectiveModel` default to the first connection/model when the
  // session hasn't pinned one yet — reflect that default in the picker.
  const activeModelId = model || effectiveModel;
  const value = selected && activeModelId ? pickerId(selected.id, activeModelId) : "";

  return {
    providers,
    value,
    disabled: connections.length === 0,
    thinkingLevel,
    onChange: (id) => {
      const target = targets.get(id);
      if (target) selectConnectionModel(target.connectionId, target.modelId);
    },
    onThinkingChange: changeThinking,
  };
}
