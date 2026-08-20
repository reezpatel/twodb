import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ContentRowDto } from "@twodb/contracts";
import { apiClient, CONTENT_QK } from "../utils";

export interface RowMutationInput {
	title?: string;
	content?: string;
	completed?: boolean;
	tags?: unknown[];
	links?: unknown[];
	attachments?: unknown[];
	values?: Record<string, unknown>;
}

export function useRowMutations(identifier: string | undefined) {
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: [CONTENT_QK, "rows", identifier],
		});

	const create = useMutation({
		mutationFn: (input: RowMutationInput) =>
			apiClient.post<{ row: ContentRowDto }>(
				`/sections/${identifier}/rows`,
				input,
			),
		onSuccess: invalidate,
	});

	const update = useMutation({
		mutationFn: ({ rowId, ...input }: RowMutationInput & { rowId: string }) =>
			apiClient.patch<{ row: ContentRowDto }>(
				`/sections/${identifier}/rows/${rowId}`,
				input,
			),
		onSuccess: invalidate,
	});

	const remove = useMutation({
		mutationFn: (rowId: string) =>
			apiClient.del(`/sections/${identifier}/rows/${rowId}`),
		onSuccess: invalidate,
	});

	const move = useMutation({
		mutationFn: ({
			rowId,
			targetSectionId,
		}: {
			rowId: string;
			targetSectionId: string;
		}) =>
			apiClient.post<{ row: ContentRowDto }>(
				`/sections/${identifier}/rows/${rowId}/move`,
				{ target_section_id: targetSectionId },
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [CONTENT_QK, "rows"] });
		},
	});

	const reorder = useMutation({
		mutationFn: ({
			rowId,
			beforeRowId,
			afterRowId,
		}: {
			rowId: string;
			beforeRowId?: string | null;
			afterRowId?: string | null;
		}) =>
			apiClient.post(`/sections/${identifier}/rows/reorder`, {
				row_id: rowId,
				before_row_id: beforeRowId ?? null,
				after_row_id: afterRowId ?? null,
			}),
		onSuccess: invalidate,
	});

	return { create, update, remove, move, reorder };
}
