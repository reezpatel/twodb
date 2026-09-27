import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { LlmConnection, LlmModel, LlmProvider } from "../../lib/llm";

export function useConnectionPicker(connectionId: string, model: string) {
  const connections = useQuery({
    queryKey: ["llm", "connections"],
    queryFn: () => api<LlmConnection[]>("/api/llm/connections"),
  });

  const providers = useQuery({
    queryKey: ["llm", "providers"],
    queryFn: () => api<LlmProvider[]>("/api/llm/providers"),
    staleTime: Infinity,
  });

  const enabled = (connections.data ?? []).filter((c) => c.enabled);
  const selected = enabled.find((c) => c.id === connectionId) ?? enabled[0];
  const provider = providers.data?.find((p) => p.id === selected?.provider);

  const models = useQuery({
    queryKey: ["llm", "models", selected?.id],
    queryFn: () => api<LlmModel[]>(`/api/llm/connections/${selected!.id}/models`),
    enabled: !!selected,
  });

  const modelList = models.data ?? [];
  const effectiveModel = model || modelList[0]?.modelId || provider?.models[0] || "";

  return { connections: enabled, selected, provider, models: modelList, effectiveModel };
}
