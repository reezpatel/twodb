import type { NotesViewProps } from "../types";
import { tableViewStyles } from "./table-view.style";

export function TableView({ notes }: NotesViewProps) {
	return (
		<section className="notes-view notes-table-view" aria-label="Notes table">
			<style jsx>{tableViewStyles}</style>
			<div className="notes-view__placeholder">
				<strong>Table view</strong>
				<p>{notes.length} notes ready for a structured table layout.</p>
			</div>
		</section>
	);
}
