import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CodeDirectory {
  id: string;
  organizationId: string;
  runnerId: string;
  cwd: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export function useCodeDirectories() {
  const queryClient = useQueryClient();

  const directories = useQuery({
    queryKey: ["code", "directories"],
    queryFn: () => api<CodeDirectory[]>("/api/code/directories"),
  });

  const createDirectory = useMutation({
    mutationFn: (input: { runnerId: string; cwd: string; displayName: string }) =>
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

  return { directories, createDirectory, renameDirectory };
}
