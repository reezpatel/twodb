import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../../utils";

export function useAuthMethods() {
	return useQuery<{ methods?: string[] }>({
		queryKey: ["twodb.identity:auth:methods"],
		queryFn: () => apiClient.get("/auth/methods"),
		staleTime: 60_000,
	});
}

export function useLoginMutation() {
	return useMutation<unknown, Error, { identifier: string; password: string }>({
		mutationFn: (vars) => apiClient.post("/auth/login", vars),
	});
}
