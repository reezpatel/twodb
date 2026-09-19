import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authRepo } from "../lib/api";

export function useAuthSession() {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
    queryFn: () => authRepo.getSession(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["auth"] });

  const logout = useMutation({
    mutationFn: () => authRepo.logout(),
    onSuccess: invalidate,
  });

  return { sessionQuery, logout, invalidate };
}
