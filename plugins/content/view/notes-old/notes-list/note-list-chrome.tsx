import type { ReactNode } from "react";
import { IconButton, Menu, Segmented } from "@twodb/ui";
import {
	ArrowDownNarrowWide,
	ArrowUpWideNarrow,
	List,
	MoreHorizontal,
	PanelLeft,
	Plus,
	Search,
	SquareChartGantt,
	SquareKanban,
	Table2,
} from "lucide-react";
import type { Box } from "../../../shell/types";
import type { NotesViewMode } from "../types";
import { noteListChromeStyles } from "./note-list-chrome.style";

type NoteListChromeProps = {
	box: Box;
	searchOpen: boolean;
	sortDesc: boolean;
	viewMode?: NotesViewMode;
	onAddNote: () => void;
	onToggleSearch: () => void;
	onToggleSort: () => void;
	onViewModeChange?: (mode: NotesViewMode) => void;
};

const VIEW_OPTIONS = [
	{ id: "list", label: "List", icon: <List size={14} /> },
	{ id: "table", label: "Table", icon: <Table2 size={14} /> },
	{ id: "kanban", label: "Kanban", icon: <SquareKanban size={14} /> },
	{ id: "project", label: "Project", icon: <SquareChartGantt size={14} /> },
] satisfies { id: NotesViewMode; label: string; icon: ReactNode }[];

function boxTitle(box: Box) {
	if (box === "inbox") return "Inbox";
	if (box === "all") return "All Notes";
	return "Archive";
}

export function NoteListChrome({
	box,
	searchOpen,
	sortDesc,
	viewMode = "list",
	onAddNote,
	onToggleSearch,
	onToggleSort,
	onViewModeChange,
}: NoteListChromeProps) {
	return (
		<div className="shell__chrome shell__chrome--list">
			<style jsx>{noteListChromeStyles}</style>
			<IconButton
				className="shell__barbtn"
				icon={<PanelLeft size={15} />}
				label="Toggle sidebar"
				size="sm"
			/>
			<strong className="shell__listtitle">{boxTitle(box)}</strong>
			<span className="shell__chromespacer" />
			<button
				type="button"
				className="shell__sort"
				onClick={onToggleSort}
				title="Sort by modified"
			>
				{sortDesc ? (
					<ArrowDownNarrowWide size={13} />
				) : (
					<ArrowUpWideNarrow size={13} />
				)}
				Modified
			</button>
			<IconButton
				active={searchOpen}
				className="shell__barbtn"
				icon={<Search size={14} />}
				label="Search notes"
				onClick={onToggleSearch}
				size="sm"
			/>
			<IconButton
				className="shell__barbtn"
				icon={<Plus size={15} />}
				label="New note"
				onClick={onAddNote}
				size="sm"
			/>
			<Menu
				placement="bottom-end"
				trigger={
					<IconButton
						className="shell__barbtn"
						icon={<MoreHorizontal size={14} />}
						label="More actions"
						size="sm"
					/>
				}
			>
				<div className="shell__viewmenu">
					<Segmented
						aria-label="Choose notes view"
						iconOnly
						items={VIEW_OPTIONS}
						value={viewMode}
						onValueChange={(mode) => onViewModeChange?.(mode as NotesViewMode)}
					/>
				</div>
			</Menu>
		</div>
	);
}
