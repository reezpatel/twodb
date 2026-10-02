import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnectionPicker } from "@/lib/use-connection-picker";
import { api } from "@/lib/api";

const THINKING_ORDER = ["off", "low", "medium", "high"];

export interface ModelConfigSessionLike {
  data:
    | {
        id: string;
        connectionId: string | null;
        model: string | null;
        thinkingLevel?: string | null;
      }
    | undefined;
}

export interface ModelConfigOptions {
  /** REST base the config PATCHes to, e.g. "/api/code/sessions" or "/api/assistant/threads". */
  endpoint?: string;
  /** react-query key prefix for invalidation; the session id is appended. */
  queryKeyBase?: readonly unknown[];
  /** Chats without thinking support (assistant threads) hide the effort picker. */
  thinking?: boolean;
}

/** Connection / model / thinking selection — seeded from the session and persisted to it on change. */
export function useModelConfig(sessionId: string | null, session: ModelConfigSessionLike, opts: ModelConfigOptions = {}) {
  const { endpoint = "/api/code/sessions", queryKeyBase = ["code", "session"], thinking = true } = opts;
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState("");
  const [model, setModel] = useState("");
  const [thinkingLevel, setThinkingLevel] = useState("medium");
  const [configOpen, setConfigOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  const { connections, selected, providers, models, effectiveModel } = useConnectionPicker(connectionId, model);
  const providerLabel = (id: string) => providers.find((p) => p.id === id)?.label ?? id;
  const activeModel = models.find((m) => m.modelId === (model || effectiveModel)) ?? null;
  const contextWindow = activeModel?.contextWindow ?? null;
  const visibleModels = models.filter((m) => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return true;
    return m.modelId.toLowerCase().includes(q) || (m.displayName ?? "").toLowerCase().includes(q);
  });

  // Levels the selected model actually supports, narrowed to the wire vocabulary.
  const thinkingLevels = useMemo(() => {
    if (!thinking) return [];
    if (!activeModel || activeModel.thinking) {
      const declared = activeModel?.thinkingLevel ?? [];
      const supported = declared.length > 0 ? THINKING_ORDER.filter((l) => declared.includes(l)) : THINKING_ORDER;
      return supported.length >= 2 ? supported : THINKING_ORDER;
    }
    return [];
  }, [activeModel, thinking]);
  const thinkingIndex = thinkingLevels.indexOf(thinkingLevel);

  const persistConfig = (patch: Record<string, string | null>) => {
    void api(`${endpoint}/${sessionId}`, { method: "PATCH", body: JSON.stringify(patch) })
      .then(() => queryClient.invalidateQueries({ queryKey: [...queryKeyBase, sessionId] }))
      .catch(() => {});
  };

  useEffect(() => {
    if (thinkingLevels.length < 2 || thinkingLevels.includes(thinkingLevel)) return;
    const next = thinkingLevels.includes("medium") ? "medium" : (thinkingLevels[Math.floor(thinkingLevels.length / 2)] ?? "off");
    setThinkingLevel(next);
    if (session.data) persistConfig({ thinkingLevel: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinkingLevels, thinkingLevel]);

  // Seed the run config from the session — selections persist per session.
  const loadedSessionId = session.data?.id;
  useEffect(() => {
    if (thinking) setThinkingLevel(session.data?.thinkingLevel ?? "medium");
    setConnectionId(session.data?.connectionId ?? "");
    setModel(session.data?.model ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedSessionId]);

  const selectConnection = (id: string) => {
    setConnectionId(id);
    setModel("");
    persistConfig({ connectionId: id, model: null });
  };

  const selectModel = (modelId: string) => {
    setModel(modelId);
    persistConfig({ connectionId: selected?.id ?? null, model: modelId });
  };

  const changeThinking = (level: string) => {
    setThinkingLevel(level);
    if (thinking) persistConfig({ thinkingLevel: level });
  };

  return {
    connections,
    selected,
    models,
    effectiveModel,
    model,
    thinkingLevel,
    thinkingLevels,
    thinkingIndex,
    activeModel,
    contextWindow,
    visibleModels,
    configOpen,
    setConfigOpen,
    modelSearch,
    setModelSearch,
    providerLabel,
    selectConnection,
    selectModel,
    changeThinking,
    showThinking: thinking,
  };
}

export type ModelConfig = ReturnType<typeof useModelConfig>;
