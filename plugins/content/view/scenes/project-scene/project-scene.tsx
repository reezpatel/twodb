import { useState } from "react";
import { ContentHeader } from "../../components/header/content-header";
import { HeaderContentMenu } from "../../components/header/header-content-menu";
import { HeaderSearchButton } from "../../components/header/header-search-button";
import { HeaderSortButton } from "../../components/header/header-sort-button";
import { NoteEditorDrawer } from "../../components/note-editor/note-editor-drawer";
import { useProjectRows } from "../../hooks/use-project-rows.hook";
import { NoteSearchRow } from "../../components/note-search/note-search-row";
import { useSection } from "../../provider/section-provider";
import { ProjectPropertiesPanel } from "./project-properties-panel";
import { projectSceneStyles } from "./project-scene.style";
import { ProjectTaskRow } from "./project-task-row";

const TABS = ["Overview", "Tasks"] as const;

export const ProjectScene = () => {
	const {
		section,
		activeViewConfig,
		setActiveViewConfig,
		openNoteId,
		setOpenNoteId,
	} = useSection();
	const { rows, isLoading, toggleCompleted } = useProjectRows();
	// Mocked tabs — Tasks is the only wired one.
	const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Tasks");

	return (
		<section className="project-scene" aria-label="Project">
			<style jsx>{projectSceneStyles}</style>

			<ContentHeader title={section?.name}>
				<HeaderSearchButton />
				<HeaderSortButton />
				<HeaderContentMenu />
			</ContentHeader>

			{activeViewConfig.showSearch && (
				<NoteSearchRow
					query={activeViewConfig.search}
					onQueryChange={(e) =>
						setActiveViewConfig({
							...activeViewConfig,
							search: e ?? "",
						})
					}
				/>
			)}

			<div className="project-scene__body">
				<main className="project-scene__main">
					<div className="project-scene__tabs">
						{TABS.map((tab) => (
							<button
								key={tab}
								className={`project-scene__tab${activeTab === tab ? " is-active" : ""}`}
								onClick={() => setActiveTab(tab)}
							>
								{tab}
								{tab === "Tasks" && (
									<span className="project-scene__tab-count">
										{rows.length}
									</span>
								)}
							</button>
						))}
					</div>

					<div className="project-scene__table">
						<div className="project-scene__table-head">
							<span>Feature</span>
							<span>Progress</span>
							<span>Urgency</span>
							<span>Assigned to</span>
						</div>
						<div className="project-scene__table-body">
							{!isLoading && rows.length === 0 ? (
								<div className="project-scene__empty">
									{activeViewConfig.search
										? `No notes match “${activeViewConfig.search}”.`
										: "Nothing here yet."}
								</div>
							) : (
								rows.map((note) => (
									<ProjectTaskRow
										key={note.id}
										note={note}
										selected={openNoteId === note.id}
										onSelect={setOpenNoteId}
										onToggleCompleted={toggleCompleted}
									/>
								))
							)}
						</div>
					</div>
				</main>

				<ProjectPropertiesPanel />
			</div>

			<NoteEditorDrawer />
		</section>
	);
};
