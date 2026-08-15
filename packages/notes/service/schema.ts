import type { Generated } from "kysely";

export interface NotesTable {
	id: string;
	workspace_id: string;
	title: string;
	body: string;
	created_by: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface NotesDB {
	notes: NotesTable;
}
