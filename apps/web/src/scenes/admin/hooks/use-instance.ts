import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch, type InstanceInfo } from "../lib/admin-api";

export function useInstance() {
	const queryClient = useQueryClient();

	const instanceQuery = useQuery({
		queryKey: ["admin", "instance"],
		queryFn: () => adminFetch<InstanceInfo>("/instance"),
	});

	const renameInstance = useMutation({
		mutationFn: (name: string) =>
			adminFetch<InstanceInfo>("/instance", {
				method: "PATCH",
				body: { name },
			}),
		onSuccess: (data) => {
			queryClient.setQueryData(["admin", "instance"], data);
		},
	});

	return { instanceQuery, renameInstance };
}
