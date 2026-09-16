import { useQuery } from "@tanstack/react-query";
import { nodeApi, nodesQueryKey } from "../lib/api";
import type { FleetNode } from "../lib/types";

const POLL_MS = 5_000;

export function useNodes() {
	return useQuery({
		queryKey: nodesQueryKey,
		queryFn: async () => {
			const data = await nodeApi.get<{ nodes: FleetNode[] }>("/nodes");
			return data.nodes;
		},
		refetchInterval: POLL_MS,
	});
}
