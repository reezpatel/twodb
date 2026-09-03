import type {
	CSSProperties,
	KeyboardEvent,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useRef, useState } from "react";
import { Inbox } from "lucide-react";
import { ContentHeader } from "../../components/header/content-header";
import { HeaderContentMenu } from "../../components/header/header-content-menu";
import { HeaderSearchButton } from "../../components/header/header-search-button";
import { HeaderSortButton } from "../../components/header/header-sort-button";
import { ListItem } from "../../components/list-item/list-item";
import { NoteEditor } from "../../components/note-editor/note-editor";
import { NoteSearchRow } from "../../components/note-search/note-search-row";
import { useSection } from "../../provider/section-provider";
import { useSectionRows } from "../../hooks/use-section-rows.hook";
import { listSceneStyles } from "./list-scene.style";

const MIN_LIST_WIDTH = 260;
const MAX_LIST_WIDTH = 560;
const DETAIL_MIN_WIDTH = 320;
const RESIZE_STEP = 24;

export const NoteListScene = () => {
	const {
		views,
		section,
		activeViewConfig,
		setActiveViewConfig,
		openNoteId,
		setOpenNoteId,
	} = useSection();
	const sceneRef = useRef<HTMLElement | null>(null);
	const [listWidth, setListWidth] = useState(340);

	const defaultView = views.find((v) => v.is_default) ?? views[0];

	const { data, isLoading } = useSectionRows();

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

	if (!defaultView) {
		return null;
	}

	const sceneStyle = {
		"--list-scene-list-width": `${listWidth}px`,
	} as CSSProperties;

	return (
		<section
			ref={sceneRef}
			className="list-scene"
			style={sceneStyle}
			aria-label="Notes"
		>
			<style jsx>{listSceneStyles}</style>

			<ContentHeader title={section?.name}>
				<HeaderSearchButton />
				<HeaderSortButton />
				<HeaderContentMenu />
			</ContentHeader>

			<div className="list-scene__list">
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
				{!isLoading && data?.rows.length === 0 ? (
					<div className="list-scene__empty">
						<Inbox size={20} />
						<p>
							{activeViewConfig.search
								? `No notes match “${activeViewConfig.search}”.`
								: "Nothing here yet."}
						</p>
					</div>
				) : (
					data?.rows?.map((note) => (
						<ListItem
							key={note.id}
							note={note}
							open={openNoteId === note.id}
							onOpen={setOpenNoteId}
						/>
					))
				)}
			</div>

			<button
				type="button"
				className="list-scene__resizer"
				aria-label="Resize notes list"
				aria-orientation="vertical"
				aria-valuemin={MIN_LIST_WIDTH}
				aria-valuemax={MAX_LIST_WIDTH}
				aria-valuenow={listWidth}
				onKeyDown={onResizeKeyDown}
				onPointerDown={startResize}
				role="separator"
			/>

			<NoteEditor />
		</section>
	);
};
