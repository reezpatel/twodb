import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../utils";

export function useSignOut() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => apiClient.post("/auth/logout"),
		onSuccess: () => {
			queryClient.setQueryData(["twodb.identity:session"], {
				principal: null,
			});
			queryClient.removeQueries({ queryKey: ["twodb.identity:memberships"] });
		},
	});
}
