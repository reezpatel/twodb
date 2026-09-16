import { useQuery } from "@tanstack/react-query";
import { nodeApi, nodeDetailQueryKey } from "../lib/api";
import type { FleetNode } from "../lib/types";
import type { NodeSecretDto } from "../../shared/types";

const POLL_MS = 5_000;

export type NodeDetail = {
	node: FleetNode;
	secrets: NodeSecretDto[];
};

export function useNodeDetail(nodeId: string | null) {
	return useQuery({
		queryKey: nodeDetailQueryKey(nodeId ?? ""),
		enabled: nodeId !== null,
		queryFn: async () => {
			const data = await nodeApi.get<NodeDetail>(`/nodes/${nodeId}`);
			return data;
		},
		refetchInterval: POLL_MS,
	});
}
