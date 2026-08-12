import { useShellState } from "../../../shell/state";
import { NoteListBody } from "./NoteListBody";
import { NoteListChrome } from "./NoteListChrome";

export function NoteList() {
	const {
		box,
		query,
		searchOpen,
		sortDesc,
		visible,
		openId,
		openNote,
		addNote,
		setQuery,
		toggleSearch,
		toggleSort,
	} = useShellState();

	return (
		<>
			<NoteListChrome
				box={box}
				searchOpen={searchOpen}
				sortDesc={sortDesc}
				onAddNote={addNote}
				onToggleSearch={toggleSearch}
				onToggleSort={toggleSort}
			/>
			<NoteListBody
				query={query}
				searchOpen={searchOpen}
				notes={visible}
				openId={openId}
				onOpenNote={openNote}
				onQueryChange={setQuery}
			/>
		</>
	);
}
