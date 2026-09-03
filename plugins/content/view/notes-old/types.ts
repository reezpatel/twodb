export type NotesViewMode = "list" | "table" | "kanban" | "project";

export interface Note {
	id: string;
	title: string;
	preview?: string;
	updatedAt?: string;
}

export type NotesViewProps = {
	query: string;
	searchOpen: boolean;
	notes: Note[];
	openId: string | null;
	onOpenNote: (id: string) => void;
	onQueryChange: (query: string) => void;
};
