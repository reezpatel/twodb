import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PostNodeBody } from "../../shared/types";
import { treeApi } from "../api";
import { CONTENT_QK } from "../utils";

export function useTreeMutations() {
	const queryClient = useQueryClient();

	const create = useMutation({
		mutationFn: (body: PostNodeBody) => treeApi.createNode(body),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: [CONTENT_QK, "tree"] }),
	});

	return { create };
}
