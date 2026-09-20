import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceRepo } from "../lib/api";

export function useWorkspaceData() {
  const queryClient = useQueryClient();

  const contextQuery = useQuery({
    queryKey: ["workspace", "context"],
    queryFn: () => workspaceRepo.getContext(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workspace"] });

  return { contextQuery, invalidate };
}
