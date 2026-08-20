import { Editor } from "./editor";
import { NoteList } from "./notes-list";
import { PropertiesPanel } from "./properties-panel";

export function NotesWorkspace() {
	return (
		<>
			<NoteList />
			<Editor />
			<PropertiesPanel />
		</>
	);
}
