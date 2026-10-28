import { useCallback, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtTokens } from "@/lib/format-tokens";
import type { LlmModel } from "@/lib/llm";
import { THINKING_ORDER, type ModelConfig } from "@/components/model-picker/use-model-config";
import type { ModelPickerProps } from "@/components/blocks/model-picker/model-picker";
import type { ModelPickerModel, ModelPickerProvider } from "@/components/blocks/model-picker/model-picker-types";

const FAVORITES_KEY = "twodb.favoriteModels";

const pickerId = (connectionId: string, modelId: string) => `${connectionId}::${modelId}`;
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Levels a model supports, in the same narrowing useModelConfig applies to the active model. */
function levelsFor(model: LlmModel): string[] {
  if (!model.thinking) return [];
  const supported = model.thinkingLevel.length > 0 ? THINKING_ORDER.filter((level) => model.thinkingLevel.includes(level)) : THINKING_ORDER;
  return supported.length >= 2 ? supported : THINKING_ORDER;
}

/**
 * Adapts the session's connection / model / thinking selection to <ModelPicker>:
 * every enabled connection's models in one list (connection = provider), the
 * thinking level as "effort", and favorites persisted to localStorage.
 */
export function useChatModelPicker(config: ModelConfig): Omit<ModelPickerProps, "children"> {
  const { connections, selected, model, effectiveModel, thinkingLevel, providerLabel, selectConnectionModel, changeThinking } = config;
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  const modelQueries = useQueries({
    queries: connections.map((connection) => ({
      queryKey: ["llm", "models", connection.id],
      queryFn: () => api<LlmModel[]>(`/api/llm/connections/${connection.id}/models`),
    })),
  });

  const { models, targets } = useMemo(() => {
    const list: ModelPickerModel[] = [];
    const lookup = new Map<string, { connectionId: string; modelId: string }>();
    connections.forEach((connection, index) => {
      for (const item of modelQueries[index]?.data ?? []) {
        const id = pickerId(connection.id, item.modelId);
        const levels = levelsFor(item);
        lookup.set(id, { connectionId: connection.id, modelId: item.modelId });
        list.push({
          id,
          label: item.displayName ?? item.modelId,
          provider: connection.provider,
          description: [connection.name, item.contextWindow ? `${fmtTokens(item.contextWindow)} context` : null].filter(Boolean).join(" · "),
          efforts: levels.length > 0 ? levels.map(capitalize) : undefined,
          badges: [item.thinking ? "thinking" : null, item.input.includes("image") ? "vision" : null].filter((badge): badge is string => badge !== null),
        });
      }
    });
    return { models: list, targets: lookup };
    // modelQueries is a fresh array each render; its data identities are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, ...modelQueries.map((query) => query.data)]);

  const providers = useMemo<ModelPickerProvider[]>(
    () => [...new Set(connections.map((connection) => connection.provider))].map((id) => ({ id, label: providerLabel(id) })),
    [connections, providerLabel],
  );

  const selectedId = selected ? pickerId(selected.id, model || effectiveModel) : null;
  const selectedModel = models.find((item) => item.id === selectedId);

  const updateFavorites = useCallback((update: (current: string[]) => string[]) => {
    setFavorites((current) => {
      const next = update(current);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    models,
    providers,
    selectedId,
    configs: selectedId && selectedModel?.efforts ? { [selectedId]: { effort: capitalize(thinkingLevel) } } : undefined,
    favorites,
    disabled: connections.length === 0,
    onModelPicked: (id) => {
      const target = targets.get(id);
      if (target) selectConnectionModel(target.connectionId, target.modelId);
    },
    onConfigChanged: (_id, patch) => {
      if (patch.effort) changeThinking(patch.effort.toLowerCase());
    },
    onFavoriteAdded: (id) => updateFavorites((current) => (current.includes(id) ? current : [...current, id])),
    onFavoriteRemoved: (id) => updateFavorites((current) => current.filter((favorite) => favorite !== id)),
  };
}
