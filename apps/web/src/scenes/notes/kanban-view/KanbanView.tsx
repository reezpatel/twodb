import type { NotesViewProps } from "../types";
import { kanbanViewStyles } from "./KanbanView.style.jsx";

export function KanbanView({ notes }: NotesViewProps) {
	return (
		<section className="notes-view notes-kanban-view" aria-label="Notes kanban">
			<style jsx>{kanbanViewStyles}</style>
			<div className="notes-view__placeholder">
				<strong>Kanban view</strong>
				<p>{notes.length} notes ready for status columns.</p>
			</div>
		</section>
	);
}
