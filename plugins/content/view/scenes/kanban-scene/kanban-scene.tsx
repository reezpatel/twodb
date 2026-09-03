import { useEffect, useMemo, useRef, useState } from "react";
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	closestCorners,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { ContentRowDto } from "@twodb/contracts";
import { IconButton, Menu, MenuDivider, MenuItem } from "@twodb/ui";
import { Check, Layers } from "lucide-react";
import { ContentHeader } from "../../components/header/content-header";
import { HeaderContentMenu } from "../../components/header/header-content-menu";
import { HeaderSearchButton } from "../../components/header/header-search-button";
import { HeaderSortButton } from "../../components/header/header-sort-button";
import { ListItem } from "../../components/list-item/list-item";
import { NoteEditorDrawer } from "../../components/note-editor/note-editor-drawer";
import { useKanbanBoard } from "../../hooks/use-kanban-board.hook";
import { useSection } from "../../provider/section-provider";
import { KanbanColumn } from "./kanban-column";
import { kanbanSceneStyles } from "./kanban-scene.style";
import { NoteSearchRow } from "../../components/note-search/note-search-row";

const DOT_PALETTE = [
	"var(--ink-3)",
	"var(--shell-blue)",
	"var(--shell-amber)",
	"var(--shell-green)",
	"var(--shell-purple)",
	"var(--shell-red)",
];

export const KanbanScene = () => {
	const {
		section,
		activeViewConfig,
		setActiveViewConfig,
		openNoteId,
		setOpenNoteId,
	} = useSection();
	const {
		boardColumns,
		groupColumn,
		selectColumns,
		setGroupBy,
		moveRow,
		addRow,
	} = useKanbanBoard();

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
	);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [lanes, setLanes] = useState<Record<string, string[]>>({});

	useEffect(() => {
		if (activeId) return;
		setLanes(
			Object.fromEntries(
				boardColumns.map((c) => [c.id, c.rows.map((r) => r.id)]),
			),
		);
	}, [boardColumns, activeId]);

	const rowsById = useMemo(() => {
		const map = new Map<string, ContentRowDto>();
		for (const col of boardColumns) {
			for (const row of col.rows) map.set(row.id, row);
		}
		return map;
	}, [boardColumns]);

	const displayColumns = useMemo(
		() =>
			boardColumns.map((col) => {
				const ids = lanes[col.id];
				if (!ids) return col;
				return {
					...col,
					rows: ids
						.map((id) => rowsById.get(id))
						.filter((r): r is ContentRowDto => !!r),
				};
			}),
		[boardColumns, lanes, rowsById],
	);

	function findColumn(id: string): string | undefined {
		if (id in lanes) return id;
		return Object.keys(lanes).find((key) => lanes[key].includes(id));
	}

	function handleDragStart({ active }: DragStartEvent) {
		setActiveId(String(active.id));
	}

	function handleDragOver({ active, over }: DragOverEvent) {
		if (!over) return;
		const id = String(active.id);
		const overId = String(over.id);
		const fromCol = findColumn(id);
		const toCol = findColumn(overId);
		if (!fromCol || !toCol || fromCol === toCol) return;

		setLanes((prev) => {
			const overIndex = prev[toCol].indexOf(overId);
			const at = overIndex >= 0 ? overIndex : prev[toCol].length;
			return {
				...prev,
				[fromCol]: prev[fromCol].filter((i) => i !== id),
				[toCol]: [...prev[toCol].slice(0, at), id, ...prev[toCol].slice(at)],
			};
		});
	}

	function handleDragEnd({ active, over }: DragEndEvent) {
		const id = String(active.id);
		setActiveId(null);
		// A drop still emits a click on the card — swallow it briefly so the
		// editor doesn't pop open after every drag.
		suppressOpenUntil.current = Date.now() + 250;
		if (!over) return;

		const colId = findColumn(String(over.id));
		if (!colId) return;

		let items = lanes[colId] ?? [];
		const from = items.indexOf(id);
		const overIndex = items.indexOf(String(over.id));
		if (overIndex >= 0 && from >= 0 && from !== overIndex) {
			items = arrayMove(items, from, overIndex);
			setLanes((prev) => ({ ...prev, [colId]: items }));
		}

		const at = items.indexOf(id);
		moveRow(id, colId, at >= 0 ? (items[at + 1] ?? null) : null);
	}

	const activeRow = activeId ? rowsById.get(activeId) : undefined;

	const suppressOpenUntil = useRef(0);
	const handleOpenNote = (id: string) => {
		if (Date.now() < suppressOpenUntil.current) return;
		setOpenNoteId(id);
	};

	return (
		<section className="kanban-scene" aria-label="Notes board">
			<style jsx>{kanbanSceneStyles}</style>

			<ContentHeader title={section?.name}>
				<HeaderSearchButton />
				<HeaderSortButton />
				<Menu
					placement="bottom-end"
					trigger={
						<IconButton
							className="shell__barbtn"
							icon={<Layers size={14} />}
							label="Group by"
							size="sm"
						/>
					}
				>
					<MenuItem
						icon={
							!groupColumn ? (
								<Check size={13} />
							) : (
								<span style={{ width: 13 }} />
							)
						}
						onClick={() => setGroupBy(null)}
					>
						Completed
					</MenuItem>
					{selectColumns.length > 0 && <MenuDivider />}
					{selectColumns.map((c) => (
						<MenuItem
							key={c.column_id}
							icon={
								groupColumn?.column_id === c.column_id ? (
									<Check size={13} />
								) : (
									<span style={{ width: 13 }} />
								)
							}
							onClick={() => setGroupBy(c.column_id)}
						>
							{c.name}
						</MenuItem>
					))}
				</Menu>
				<HeaderContentMenu />
			</ContentHeader>

			{activeViewConfig.showSearch && (
				<NoteSearchRow
					query={activeViewConfig.search}
					onQueryChange={(e) =>
						setActiveViewConfig({
							...activeViewConfig,
							search: e ?? "",
						})
					}
				/>
			)}

			<div className="kanban-scene__board">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCorners}
					onDragStart={handleDragStart}
					onDragOver={handleDragOver}
					onDragEnd={handleDragEnd}
					onDragCancel={() => setActiveId(null)}
				>
					{displayColumns.map((col, index) => (
						<KanbanColumn
							key={col.id}
							column={col}
							dotColor={DOT_PALETTE[index % DOT_PALETTE.length]}
							openNoteId={openNoteId}
							onOpenNote={handleOpenNote}
							onAddNote={addRow}
						/>
					))}
					<DragOverlay>
						{activeRow ? (
							<div className="kanban-scene__overlay-card">
								<ListItem note={activeRow} open={false} onOpen={() => {}} />
							</div>
						) : null}
					</DragOverlay>
				</DndContext>
			</div>

			<NoteEditorDrawer />
		</section>
	);
};
