import { useCallback, useMemo } from "react";
import type { ContentRowDto, ContentSchemaColumn } from "@twodb/contracts";
import { useSectionRowMutations } from "./use-section-row-mutations.hook";
import { useSectionRows } from "./use-section-rows.hook";
import { useSection } from "../provider/section-provider";

export interface KanbanColumn {
	/** Choice value, "__none" for the no-value bucket, or "open"/"done". */
	id: string;
	label: string;
	rows: ContentRowDto[];
}

const NO_VALUE = "__none";

const COMPLETED_COLUMNS: Pick<KanbanColumn, "id" | "label">[] = [
	{ id: "open", label: "To Do" },
	{ id: "done", label: "Done" },
];

function columnKey(
	row: ContentRowDto,
	groupColumn: ContentSchemaColumn | null,
) {
	if (!groupColumn) return row.completed ? "done" : "open";
	const value = row.values[groupColumn.column_id];
	return typeof value === "string" ? value : NO_VALUE;
}

export function useKanbanBoard() {
	const { columns, activeViewConfig, setActiveViewConfig } = useSection();
	const { data, isLoading } = useSectionRows();
	const { create, update, reorder } = useSectionRowMutations();

	const selectColumns = useMemo(
		() => columns.filter((c) => c.type === "select"),
		[columns],
	);

	// undefined = never picked → first select column; null = explicit "Completed"
	const groupColumn =
		activeViewConfig.group_by === undefined
			? (selectColumns[0] ?? null)
			: (selectColumns.find((c) => c.column_id === activeViewConfig.group_by) ??
				null);

	const setGroupBy = useCallback(
		(columnId: string | null) =>
			setActiveViewConfig((cfg) => ({ ...cfg, group_by: columnId })),
		[setActiveViewConfig],
	);

	const boardColumns = useMemo<KanbanColumn[]>(() => {
		const skeleton: KanbanColumn[] = groupColumn
			? [
					{ id: NO_VALUE, label: `No ${groupColumn.name}`, rows: [] },
					...(groupColumn.options?.choices ?? []).map((c) => ({
						id: c.value,
						label: c.label,
						rows: [],
					})),
				]
			: COMPLETED_COLUMNS.map((c) => ({ ...c, rows: [] }));

		const byId = new Map(skeleton.map((c) => [c.id, c]));
		const fallback = groupColumn ? byId.get(NO_VALUE) : undefined;
		const sorted = [...(data?.rows ?? [])].sort(
			(a, b) => a.position - b.position,
		);
		for (const row of sorted) {
			const column = byId.get(columnKey(row, groupColumn)) ?? fallback;
			column?.rows.push(row);
		}
		return skeleton;
	}, [data, groupColumn]);

	const moveRow = useCallback(
		(rowId: string, toColumnId: string, beforeRowId: string | null) => {
			const row = data?.rows.find((r) => r.id === rowId);
			if (!row) return;

			if (groupColumn) {
				const next = toColumnId === NO_VALUE ? null : toColumnId;
				if ((row.values[groupColumn.column_id] ?? null) !== next) {
					update.mutate({
						rowId,
						body: {
							values: { ...row.values, [groupColumn.column_id]: next },
						},
					});
				}
			} else {
				const completed = toColumnId === "done";
				if (row.completed !== completed) {
					update.mutate({ rowId, body: { completed } });
				}
			}
			reorder.mutate({ rowId, beforeRowId });
		},
		[data, groupColumn, update, reorder],
	);

	const addRow = useCallback(
		(title: string, columnId: string) => {
			if (groupColumn) {
				create.mutate({
					title,
					values: {
						[groupColumn.column_id]: columnId === NO_VALUE ? null : columnId,
					},
				});
			} else {
				create.mutate({ title, completed: columnId === "done" });
			}
		},
		[groupColumn, create],
	);

	return {
		boardColumns,
		groupColumn,
		selectColumns,
		setGroupBy,
		moveRow,
		addRow,
		isLoading,
	};
}
