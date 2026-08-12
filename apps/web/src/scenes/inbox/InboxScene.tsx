import { useEffect } from "react";
import { Editor } from "../notes/Editor";
import { NoteList } from "../notes/notes-list";
import { PropertiesPanel } from "../notes/PropertiesPanel";
import { useShellState } from "../../shell/state";

export function InboxScene() {
	const { pickSidebar } = useShellState();

	useEffect(() => {
		pickSidebar("inbox");
	}, []);

	return (
		<>
			<NoteList />
			<Editor />
			<PropertiesPanel />
		</>
	);
}
