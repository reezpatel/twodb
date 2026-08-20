import type {
	CSSProperties,
	KeyboardEvent,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useRef, useState } from "react";
import { useShellState } from "../../shell/state";
import { KanbanView } from "./kanban-view";
import { notesSceneStyles } from "./notes-scene.style";
import { NotesListView } from "./notes-list";
import { NoteListChrome } from "./notes-list/note-list-chrome";
import { ProjectView } from "./project-view";
import { TableView } from "./table-view";
import type { NotesViewMode, NotesViewProps } from "./types";

const MIN_LIST_WIDTH = 260;
const MAX_LIST_WIDTH = 560;
const DETAIL_MIN_WIDTH = 320;
const RESIZE_STEP = 24;

function NotesCurrentView({
	mode,
	props,
}: {
	mode: NotesViewMode;
	props: NotesViewProps;
}) {
	if (mode === "table") return <TableView {...props} />;
	if (mode === "kanban") return <KanbanView {...props} />;
	if (mode === "project") return <ProjectView {...props} />;
	return <NotesListView {...props} />;
}

export function NotesScene() {
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
	const sceneRef = useRef<HTMLElement | null>(null);
	const [listWidth, setListWidth] = useState(320);
	const [viewMode, setViewMode] = useState<NotesViewMode>("list");
	const isListView = viewMode === "list";

	const clampListWidth = useCallback((width: number) => {
		const sceneWidth = sceneRef.current?.getBoundingClientRect().width ?? 960;
		const maxWidth = Math.max(
			MIN_LIST_WIDTH,
			Math.min(MAX_LIST_WIDTH, sceneWidth - DETAIL_MIN_WIDTH),
		);
		return Math.min(maxWidth, Math.max(MIN_LIST_WIDTH, width));
	}, []);

	function resizeListTo(width: number) {
		setListWidth(clampListWidth(width));
	}

	function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
		const scene = sceneRef.current;
		if (!scene) return;

		event.preventDefault();
		const left = scene.getBoundingClientRect().left;

		function onPointerMove(moveEvent: PointerEvent) {
			setListWidth(clampListWidth(moveEvent.clientX - left));
		}

		function onPointerUp() {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		}

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
	}

	function onResizeKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			resizeListTo(listWidth - RESIZE_STEP);
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			resizeListTo(listWidth + RESIZE_STEP);
		}
		if (event.key === "Home") {
			event.preventDefault();
			resizeListTo(MIN_LIST_WIDTH);
		}
		if (event.key === "End") {
			event.preventDefault();
			resizeListTo(MAX_LIST_WIDTH);
		}
	}

	const sceneStyle = {
		"--notes-list-width": `${listWidth}px`,
	} as CSSProperties;
	const sceneClass = `notes-scene ${isListView ? "notes-scene--list" : "notes-scene--single"}`;
	const viewProps: NotesViewProps = {
		query,
		searchOpen,
		notes: visible,
		openId,
		onOpenNote: openNote,
		onQueryChange: setQuery,
	};

	return (
		<section ref={sceneRef} className={sceneClass} style={sceneStyle}>
			<style jsx>{notesSceneStyles}</style>
			{isListView ? (
				<>
					<NoteListChrome
						box={box}
						searchOpen={searchOpen}
						sortDesc={sortDesc}
						viewMode={viewMode}
						onAddNote={addNote}
						onToggleSearch={toggleSearch}
						onToggleSort={toggleSort}
						onViewModeChange={setViewMode}
					/>
					<section className="notes-scene__list" aria-label="Notes list">
						<NotesCurrentView mode={viewMode} props={viewProps} />
					</section>
					<button
						type="button"
						className="notes-scene__resizer"
						aria-label="Resize notes list"
						aria-orientation="vertical"
						aria-valuemin={MIN_LIST_WIDTH}
						aria-valuemax={MAX_LIST_WIDTH}
						aria-valuenow={listWidth}
						onKeyDown={onResizeKeyDown}
						onPointerDown={startResize}
						role="separator"
					/>
					<section className="notes-scene__detail" aria-label="Note detail" />
				</>
			) : (
				<>
					<NoteListChrome
						box={box}
						searchOpen={searchOpen}
						sortDesc={sortDesc}
						viewMode={viewMode}
						onAddNote={addNote}
						onToggleSearch={toggleSearch}
						onToggleSort={toggleSort}
						onViewModeChange={setViewMode}
					/>
					<section
						className="notes-scene__view"
						aria-label={`${viewMode} notes view`}
					>
						<NotesCurrentView mode={viewMode} props={viewProps} />
					</section>
				</>
			)}
		</section>
	);
}
