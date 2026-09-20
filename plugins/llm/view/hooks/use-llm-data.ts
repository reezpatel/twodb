import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { llmRepo } from "../lib/api";
import type { CreateLlmConnectionRequest, UpdateLlmConnectionRequest, UpdateLlmWorkspaceSettingsRequest } from "../../shared/api";

export function useLlmData() {
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ["llm", "overview"],
    queryFn: () => llmRepo.getOverview(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["llm"] });

  const saveSettings = useMutation({
    mutationFn: (settings: UpdateLlmWorkspaceSettingsRequest) => llmRepo.updateSettings(settings),
    onSuccess: invalidate,
  });

  const createConnection = useMutation({
    mutationFn: (body: CreateLlmConnectionRequest) => llmRepo.createConnection(body),
    onSuccess: invalidate,
  });

  const updateConnection = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateLlmConnectionRequest }) => llmRepo.updateConnection(id, body),
    onSuccess: invalidate,
  });

  const useConnectionUsage = (connectionId: string) =>
    useQuery({
      queryKey: ["llm", "usage", connectionId],
      queryFn: () => llmRepo.getConnectionUsage(connectionId),
      enabled: connectionId !== "",
      retry: false,
      staleTime: 60_000,
    });

  const removeConnection = useMutation({
    mutationFn: (id: string) => llmRepo.deleteConnection(id),
    onSuccess: invalidate,
  });

  return {
    overviewQuery,
    useConnectionUsage,
    saveSettings,
    createConnection,
    updateConnection,
    removeConnection,
  };
}
