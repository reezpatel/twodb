import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** File walk for the composer's @ mentions — one fetch, cached, filtered client-side. */
export function useDirectoryFiles(directoryId: string | null) {
  return useQuery({
    queryKey: ["code", "directories", directoryId, "files"],
    queryFn: () => api<{ files: string[] }>(`/api/code/directories/${directoryId}/files`),
    enabled: !!directoryId,
    staleTime: 60_000,
    retry: false,
  });
}
