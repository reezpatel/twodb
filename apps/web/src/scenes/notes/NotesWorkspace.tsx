import { Editor } from "./Editor";
import { NoteList } from "./notes-list";
import { PropertiesPanel } from "./PropertiesPanel";

export function NotesWorkspace() {
	return (
		<>
			<NoteList />
			<Editor />
			<PropertiesPanel />
		</>
	);
}
