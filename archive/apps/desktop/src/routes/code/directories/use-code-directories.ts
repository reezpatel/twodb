import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSpaces } from "@/components/space-provider";

export interface CodeDirectory {
  id: string;
  organizationId: string;
  runnerId: string;
  cwd: string;
  displayName: string;
  /** Space this directory belongs to; null = base. */
  spaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useCodeDirectories() {
  const queryClient = useQueryClient();
  const { selected } = useSpaces();
  // The selection rides every request as the x-space-ids header and is part of
  // the key — switching spaces refetches without a manual reload.
  const selectionKey = selected?.join(",") ?? "all";

  const directories = useQuery({
    queryKey: ["code", "directories", selectionKey],
    queryFn: () => api<CodeDirectory[]>("/api/code/directories"),
  });

  const createDirectory = useMutation({
    mutationFn: (input: { runnerId: string; cwd: string; displayName: string; spaceId?: string | null }) =>
      api<CodeDirectory>("/api/code/directories", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["code", "directories"],
      }),
  });

  const renameDirectory = useMutation({
    mutationFn: ({ id, displayName }: { id: string; displayName: string }) =>
      api<CodeDirectory>(`/api/code/directories/${id}`, { method: "PATCH", body: JSON.stringify({ displayName }) }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["code", "directories"],
      }),
  });

  /** Partial update — space assignment (and later fields) without a rename. */
  const updateDirectory = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api<CodeDirectory>(`/api/code/directories/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["code", "directories"],
      }),
  });

  return { directories, createDirectory, renameDirectory, updateDirectory };
}
