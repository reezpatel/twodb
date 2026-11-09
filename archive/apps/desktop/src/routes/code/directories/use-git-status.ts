import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface GitStatus {
  git: boolean;
  branch: string | null;
  origin: string | null;
  dirtyFiles: number;
  ahead: number | null;
  behind: number | null;
}

export function useGitStatus(directoryId: string | null) {
  return useQuery({
    queryKey: ["code", "directories", directoryId, "git"],
    queryFn: () => api<GitStatus>(`/api/code/directories/${directoryId}/git-status`),
    enabled: !!directoryId,
    retry: false,
  });
}
