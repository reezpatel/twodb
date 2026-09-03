import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { IconButton } from "@twodb/ui";
import { Plus } from "lucide-react";
import type { KanbanColumn as KanbanColumnData } from "../../hooks/use-kanban-board.hook";
import { KanbanCard } from "./kanban-card";
import { kanbanColumnStyles } from "./kanban-column.style";

type KanbanColumnProps = {
	column: KanbanColumnData;
	dotColor: string;
	openNoteId: string | null;
	onOpenNote: (id: string) => void;
	onAddNote: (title: string, columnId: string) => void;
};

export function KanbanColumn({
	column,
	dotColor,
	openNoteId,
	onOpenNote,
	onAddNote,
}: KanbanColumnProps) {
	const [draft, setDraft] = useState<string | null>(null);
	const { setNodeRef, isOver } = useDroppable({ id: column.id });

	function commitDraft() {
		const title = draft?.trim();
		if (title) onAddNote(title, column.id);
		setDraft(null);
	}

	return (
		<section
			className={`kanban-column${isOver ? " is-drop" : ""}`}
			aria-label={column.label}
		>
			<style jsx>{kanbanColumnStyles}</style>

			<header className="kanban-column__head">
				<span
					className="kanban-column__dot"
					style={{ background: dotColor }}
					aria-hidden="true"
				/>
				<span className="kanban-column__title">{column.label}</span>
				<span className="kanban-column__count">{column.rows.length}</span>
				<span className="kanban-column__actions">
					<IconButton
						label={`Add note to ${column.label}`}
						icon={<Plus size={14} />}
						size="sm"
						onClick={() => setDraft("")}
					/>
				</span>
			</header>

			<div ref={setNodeRef} className="kanban-column__body">
				<SortableContext
					items={column.rows.map((r) => r.id)}
					strategy={verticalListSortingStrategy}
				>
					{draft !== null ? (
						<div className="kanban-column__composer">
							<input
								autoFocus
								value={draft}
								placeholder="Name the note…"
								aria-label="New note title"
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") commitDraft();
									if (e.key === "Escape") setDraft(null);
								}}
								onBlur={commitDraft}
							/>
						</div>
					) : (
						<button
							type="button"
							className="kanban-column__add"
							onClick={() => setDraft("")}
							aria-label={`Add note to ${column.label}`}
						>
							<Plus aria-hidden="true" />
						</button>
					)}

					{column.rows.map((note) => (
						<KanbanCard
							key={note.id}
							note={note}
							open={openNoteId === note.id}
							onOpen={onOpenNote}
						/>
					))}
				</SortableContext>
			</div>
		</section>
	);
}
