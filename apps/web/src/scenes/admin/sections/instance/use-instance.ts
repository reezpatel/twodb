import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminRepo } from "../../lib/admin-api";

export function useInstance() {
  const queryClient = useQueryClient();

  const instanceQuery = useQuery({
    queryKey: ["admin", "instance"],
    queryFn: () => adminRepo.getInstance(),
  });

  const renameInstance = useMutation({
    mutationFn: (name: string) => adminRepo.updateInstance(name),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "instance"], data);
    },
  });

  return { instanceQuery, renameInstance };
}
