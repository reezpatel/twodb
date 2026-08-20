import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	ContentColumnConfig,
	ContentSchemaColumn,
	ContentViewDto,
	ContentViewType,
} from "@twodb/contracts";
import { apiClient, CONTENT_QK } from "../utils";

export function useColumnMutations(identifier: string | undefined) {
	const queryClient = useQueryClient();
	const invalidate = () => {
		queryClient.invalidateQueries({
			queryKey: [CONTENT_QK, "schema", identifier],
		});
		queryClient.invalidateQueries({
			queryKey: [CONTENT_QK, "rows", identifier],
		});
	};

	const add = useMutation({
		mutationFn: (input: {
			name: string;
			type: string;
			options?: ContentColumnConfig["options"];
		}) =>
			apiClient.post<{ column: ContentSchemaColumn }>(
				`/sections/${identifier}/columns`,
				input,
			),
		onSuccess: invalidate,
	});

	const update = useMutation({
		mutationFn: ({
			columnId,
			...input
		}: {
			columnId: string;
			name?: string;
			type?: string;
			position?: number;
		}) =>
			apiClient.patch<{ column: ContentSchemaColumn }>(
				`/sections/${identifier}/columns/${columnId}`,
				input,
			),
		onSuccess: invalidate,
	});

	const remove = useMutation({
		mutationFn: (columnId: string) =>
			apiClient.del(`/sections/${identifier}/columns/${columnId}`),
		onSuccess: invalidate,
	});

	return { add, update, remove };
}

export function useViewMutations(identifier: string | undefined) {
	const queryClient = useQueryClient();
	const invalidate = () => {
		queryClient.invalidateQueries({
			queryKey: [CONTENT_QK, "views", identifier],
		});
		queryClient.invalidateQueries({
			queryKey: [CONTENT_QK, "schema", identifier],
		});
	};

	const create = useMutation({
		mutationFn: (input: { name: string; type: ContentViewType }) =>
			apiClient.post<{ view: ContentViewDto }>(
				`/sections/${identifier}/views`,
				input,
			),
		onSuccess: invalidate,
	});

	const setDefault = useMutation({
		mutationFn: (viewId: string) =>
			apiClient.post<{ view: ContentViewDto }>(
				`/sections/${identifier}/views/${viewId}/default`,
			),
		onSuccess: invalidate,
	});

	const remove = useMutation({
		mutationFn: (viewId: string) =>
			apiClient.del(`/sections/${identifier}/views/${viewId}`),
		onSuccess: invalidate,
	});

	return { create, setDefault, remove };
}
