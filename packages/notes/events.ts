import type { EventsFor, Note } from "@twodb/contracts";

export interface NotesEvents
	extends EventsFor<
		"twodb.notes",
		{
			"twodb.notes.note.created": { note: Note };
			"twodb.notes.note.updated": { note: Note };
			"twodb.notes.note.deleted": { noteId: string };
			"twodb.notes.note.selected": { noteId: string };
		}
	> {}
