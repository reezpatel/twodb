import type { Note } from "../../shell/types";

export type NotesViewMode = "list" | "table" | "kanban" | "project";

export type NotesViewProps = {
	query: string;
	searchOpen: boolean;
	notes: Note[];
	openId: string | null;
	onOpenNote: (id: string) => void;
	onQueryChange: (query: string) => void;
};
