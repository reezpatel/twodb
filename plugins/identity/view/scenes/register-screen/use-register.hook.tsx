import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../../utils";

export function useAuthMethods() {
	return useQuery<{ methods?: string[] }>({
		queryKey: ["twodb.identity:auth:methods"],
		queryFn: () => apiClient.get("/auth/methods"),
		staleTime: 60_000,
	});
}

export function useRegisterMutation() {
	return useMutation<
		unknown,
		Error,
		{ name: string; identifier: string; password: string }
	>({
		mutationFn: ({ name, identifier, password }) =>
			apiClient.post("/auth/register", {
				name,
				...(identifier.includes("@")
					? { email: identifier }
					: { phone: identifier }),
				password,
			}),
	});
}
