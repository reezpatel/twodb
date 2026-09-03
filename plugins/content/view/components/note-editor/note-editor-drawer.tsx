import { IconButton } from "@twodb/ui";
import { X } from "lucide-react";
import { useSection } from "../../provider/section-provider";
import { NoteEditor } from "./note-editor";
import { noteEditorDrawerStyles } from "./note-editor-drawer.style";

/** Floating note editor — slides in from the right over kanban/project scenes. */
export function NoteEditorDrawer() {
	const { openNoteId, setOpenNoteId } = useSection();

	if (!openNoteId) return null;

	return (
		<div className="note-editor-drawer">
			<style jsx>{noteEditorDrawerStyles}</style>
			<button
				type="button"
				className="note-editor-drawer__backdrop"
				aria-label="Close editor"
				onClick={() => setOpenNoteId(null)}
			/>
			<aside className="note-editor-drawer__panel">
				<div className="note-editor-drawer__close">
					<IconButton
						icon={<X size={14} />}
						label="Close editor"
						onClick={() => setOpenNoteId(null)}
						size="sm"
					/>
				</div>
				<NoteEditor />
			</aside>
		</div>
	);
}
