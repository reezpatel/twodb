import type { NotesViewProps } from "../types";
import { projectViewStyles } from "./ProjectView.style.jsx";

export function ProjectView({ notes }: NotesViewProps) {
	return (
		<section
			className="notes-view notes-project-view"
			aria-label="Notes project view"
		>
			<style jsx>{projectViewStyles}</style>
			<div className="notes-view__placeholder">
				<strong>Project view</strong>
				<p>{notes.length} notes ready for a project timeline.</p>
			</div>
		</section>
	);
}
