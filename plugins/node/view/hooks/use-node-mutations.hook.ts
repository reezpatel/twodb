import { useMutation, useQueryClient } from "@tanstack/react-query";
import { nodeApi, nodeDetailQueryKey, nodesQueryKey } from "../lib/api";
import type { FleetNode, RevealedSecret } from "../lib/types";
import type { NodeDto, NodeSecretDto } from "../../shared/types";

export type CreateNodeResult = {
	node: FleetNode;
	secret: string;
};

export type CreateSecretResult = {
	secret: NodeSecretDto;
	plaintext: string;
};

export function useNodeMutations() {
	const queryClient = useQueryClient();

	const invalidateNode = (nodeId: string) => {
		queryClient.invalidateQueries({ queryKey: nodesQueryKey });
		queryClient.invalidateQueries({ queryKey: nodeDetailQueryKey(nodeId) });
	};

	const create = useMutation({
		mutationFn: (input: { name: string }) =>
			nodeApi.post<CreateNodeResult>("/nodes", input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: nodesQueryKey });
		},
	});

	const rename = useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			nodeApi.patch<{ node: NodeDto }>(`/nodes/${id}`, { name }),
		onSuccess: (data) => invalidateNode(data.node.id),
	});

	const remove = useMutation({
		mutationFn: (id: string) => nodeApi.del(`/nodes/${id}`),
		onSuccess: (_data, id) => {
			queryClient.removeQueries({ queryKey: nodeDetailQueryKey(id) });
			queryClient.invalidateQueries({ queryKey: nodesQueryKey });
		},
	});

	const createSecret = useMutation({
		mutationFn: ({ nodeId, label }: { nodeId: string; label?: string }) =>
			nodeApi
				.post<CreateSecretResult>(`/nodes/${nodeId}/secrets`, {
					label: label || undefined,
				})
				.then(
					(data): RevealedSecret => ({
						label: data.secret.label,
						plaintext: data.plaintext,
					}),
				),
		onSuccess: (_data, input) => invalidateNode(input.nodeId),
	});

	const revokeSecret = useMutation({
		mutationFn: ({ nodeId, secretId }: { nodeId: string; secretId: string }) =>
			nodeApi.del(`/nodes/${nodeId}/secrets/${secretId}`),
		onSuccess: (_data, input) => invalidateNode(input.nodeId),
	});

	return { create, rename, remove, createSecret, revokeSecret };
}
