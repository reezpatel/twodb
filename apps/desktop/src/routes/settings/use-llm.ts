import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { LlmConnection, LlmModel, LlmProvider } from "../../lib/llm";

export type ConnectionModal = { mode: "closed" } | { mode: "create" } | { mode: "edit"; connection: LlmConnection };

export interface ConnectionTestResult {
  ok: boolean;
  model: string;
  ms: number;
  reply?: string;
  usage?: { inputTokens: number; outputTokens: number; cachedTokens: number };
  error?: string;
}

export function useLlm() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ConnectionModal>({ mode: "closed" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [modelsFor, setModelsFor] = useState<LlmConnection | null>(null);

  const providers = useQuery({
    queryKey: ["llm", "providers"],
    queryFn: () => api<LlmProvider[]>("/api/llm/providers"),
    staleTime: Infinity,
  });

  const connections = useQuery({
    queryKey: ["llm", "connections"],
    queryFn: () => api<LlmConnection[]>("/api/llm/connections"),
  });

  const connectionModels = useQuery({
    queryKey: ["llm", "connection-models", modelsFor?.id],
    queryFn: () => api<LlmModel[]>(`/api/llm/connections/${modelsFor!.id}/models`),
    enabled: !!modelsFor,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["llm", "connections"] });

  const toggle = useMutation({
    mutationFn: (connection: LlmConnection) =>
      api(`/api/llm/connections/${connection.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !connection.enabled }),
      }),
    onSuccess: invalidate,
  });

  const invalidateModels = () => queryClient.invalidateQueries({ queryKey: ["llm", "models"] });

  const refreshAll = useMutation({
    mutationFn: () =>
      api<{ id: string; name: string; count: number; warning?: string; error?: string }[]>("/api/llm/refresh-models", { method: "POST", body: "{}" }),
    onSuccess: (results) => {
      invalidateModels();
      const failed = results.filter((r) => r.error);
      setActionError(failed.length > 0 ? `Model refresh failed for: ${failed.map((r) => r.name).join(", ")}` : null);
    },
    onError: (e) => setActionError(e.message),
  });

  const refreshOne = useMutation({
    mutationFn: (id: string) => api(`/api/llm/connections/${id}/refresh-models`, { method: "POST", body: "{}" }),
    onSuccess: invalidateModels,
    onError: (e) => setActionError(e.message),
  });

  const testConnection = useMutation({
    mutationFn: (id: string) => api<ConnectionTestResult>(`/api/llm/connections/${id}/test`, { method: "POST", body: "{}" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/llm/connections/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const onSaved = () => {
    setModal({ mode: "closed" });
    void invalidate();
  };

  const onDelete = async (connection: LlmConnection) => {
    setActionError(null);
    if (!window.confirm(`Delete connection "${connection.name}"?`)) return;
    try {
      await remove.mutateAsync(connection.id);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  return {
    providers: providers.data ?? [],
    connections,
    modal,
    setModal,
    toggle,
    refreshAll,
    refreshOne,
    testConnection,
    actionError,
    onSaved,
    onDelete,
    modelsFor,
    setModelsFor,
    connectionModels,
  };
}
