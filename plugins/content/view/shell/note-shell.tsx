import { useParams } from "react-router";
import { SectionProvider, useSection } from "../provider/section-provider";
import { KanbanScene } from "../scenes/kanban-scene/kanban-scene";
import { NoteListScene } from "../scenes/list-scene/list-scene";
import { ProjectScene } from "../scenes/project-scene/project-scene";
import { TableScene } from "../scenes/table-scene/table-scene";

const SectionScene = () => {
	const { activeViewConfig } = useSection();

	if (activeViewConfig.type === "table") {
		return <TableScene />;
	}
	if (activeViewConfig.type === "kanban") {
		return <KanbanScene />;
	}
	if (activeViewConfig.type === "project") {
		return <ProjectScene />;
	}
	return <NoteListScene />;
};

export const NotesShell = () => {
	const { sectionId = "" } = useParams();

	return (
		<SectionProvider sectionId={sectionId}>
			<SectionScene />
		</SectionProvider>
	);
};
