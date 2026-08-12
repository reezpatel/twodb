import { Inbox } from "lucide-react";
import type { Note } from "../../../shell/types";
import { NoteListItem } from "./NoteListItem";
import { noteListBodyStyles } from "./NoteListBody.style.jsx";
import { NoteSearchRow } from "./NoteSearchRow";

type NoteListBodyProps = {
	query: string;
	searchOpen: boolean;
	notes: Note[];
	openId: string | null;
	onOpenNote: (id: string) => void;
	onQueryChange: (query: string) => void;
};

export function NoteListBody({
	query,
	searchOpen,
	notes,
	openId,
	onOpenNote,
	onQueryChange,
}: NoteListBodyProps) {
	return (
		<div className="shell__list">
			<style jsx>{noteListBodyStyles}</style>
			{searchOpen && (
				<NoteSearchRow query={query} onQueryChange={onQueryChange} />
			)}
			{notes.length === 0 ? (
				<div className="shell__empty">
					<Inbox size={20} />
					<p>{query ? `No notes match “${query}”.` : "Nothing here yet."}</p>
				</div>
			) : (
				notes.map((note) => (
					<NoteListItem
						key={note.id}
						note={note}
						open={openId === note.id}
						onOpen={onOpenNote}
					/>
				))
			)}
		</div>
	);
}
