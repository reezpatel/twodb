import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateRowBody, UpdateRowBody } from "../../shared/types";
import { PLUGIN_ID } from "../../shared/constants";
import { rowsApi } from "../api";
import { useSection } from "../provider/section-provider";

export function useSectionRowMutations() {
	const { section } = useSection();
	const queryClient = useQueryClient();
	const sectionId = section?.id ?? "";

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: [PLUGIN_ID, "rows"] });
		queryClient.invalidateQueries({ queryKey: [PLUGIN_ID, "note"] });
		queryClient.invalidateQueries({ queryKey: [PLUGIN_ID, "note-content"] });
	};

	const create = useMutation({
		mutationFn: (body: CreateRowBody) => rowsApi.create(sectionId, body),
		onSuccess: invalidate,
	});

	const update = useMutation({
		mutationFn: ({ rowId, body }: { rowId: string; body: UpdateRowBody }) =>
			rowsApi.update(sectionId, rowId, body),
		onSuccess: invalidate,
	});

	const remove = useMutation({
		mutationFn: (rowId: string) => rowsApi.remove(sectionId, rowId),
		onSuccess: invalidate,
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
			rowsApi.reorder(sectionId, {
				row_id: rowId,
				before_row_id: beforeRowId ?? null,
				after_row_id: afterRowId ?? null,
			}),
		onSuccess: invalidate,
	});

	return { create, update, remove, reorder };
}
