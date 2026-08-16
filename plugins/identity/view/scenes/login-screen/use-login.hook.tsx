import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../../utils";

export type AuthMethod = { method: string; enabled: boolean };

export function useAuthMethods() {
	return useQuery<{ methods?: AuthMethod[] }>({
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
