import { useCallback, useMemo } from "react";
import { useSectionRowMutations } from "./use-section-row-mutations.hook";
import { useSectionRows } from "./use-section-rows.hook";

export function useProjectRows() {
	const { data, isLoading } = useSectionRows();
	const { update } = useSectionRowMutations();

	const rows = useMemo(
		() => [...(data?.rows ?? [])].sort((a, b) => a.position - b.position),
		[data],
	);

	const toggleCompleted = useCallback(
		(rowId: string, completed: boolean) =>
			update.mutate({ rowId, body: { completed } }),
		[update],
	);

	return { rows, isLoading, toggleCompleted };
}
