import { useQuery } from "@tanstack/react-query";
import type { ContentNodeDto } from "@twodb/contracts";
import { apiClient, CONTENT_QK, contentQueryRetry } from "../utils";

export function useTree() {
	return useQuery({
		queryKey: [CONTENT_QK, "tree"],
		...contentQueryRetry,
		queryFn: () => apiClient.get<{ nodes: ContentNodeDto[] }>("/tree"),
		select: (data) => data.nodes,
	});
}
