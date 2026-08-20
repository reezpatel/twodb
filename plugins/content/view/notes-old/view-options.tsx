import {
	List,
	SquareChartGantt,
	SquareKanban,
	Table2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { NotesViewMode } from "./types";

export const VIEW_OPTIONS = [
	{ id: "list", label: "List", icon: <List size={14} /> },
	{ id: "table", label: "Table", icon: <Table2 size={14} /> },
	{ id: "kanban", label: "Kanban", icon: <SquareKanban size={14} /> },
	{ id: "project", label: "Project", icon: <SquareChartGantt size={14} /> },
] satisfies { id: NotesViewMode; label: string; icon: ReactNode }[];