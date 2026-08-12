import { TagChip } from "@twodb/ui";
import type { Note } from "../../../shell/types";
import { NoteMarker } from "./NoteMarker";
import { noteListItemStyles } from "./NoteListItem.style.jsx";

type NoteListItemProps = {
	note: Note;
	open: boolean;
	onOpen: (id: string) => void;
};

export function NoteListItem({ note, open, onOpen }: NoteListItemProps) {
	return (
		<article
			className={`shell__note ${open ? "is-open" : ""}`}
			onClick={() => onOpen(note.id)}
		>
			<style jsx>{noteListItemStyles}</style>
			<div className="shell__notehead">
				<strong>
					<NoteMarker marker={note.marker} />
					{note.title}
				</strong>
			</div>
			<p>{note.preview}</p>
			{note.tags.length > 0 && (
				<div className="shell__notechips">
					{note.tags.map((tag) => (
						<TagChip
							key={tag.label}
							color={`var(--shell-${tag.tone})`}
							background={`var(--shell-${tag.tone}-bg)`}
							icon={tag.link ? "link" : "tag"}
						>
							{tag.label}
						</TagChip>
					))}
				</div>
			)}
			<div className="shell__notefoot">
				<span>{note.ago}</span>
			</div>
		</article>
	);
}
