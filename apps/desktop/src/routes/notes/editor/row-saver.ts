import { useMemo } from "react";
import type { NoteRecord, NotesViewHook } from "../view/use-notes-view";
import type { EditablePage, PageSaver } from "./use-note-editor";

/** Database row → the editor's page shape. */
export function rowPage(row: NoteRecord): EditablePage {
  return { id: row.noteId, title: row.title, icon: row.icon, cover: row.cover, content: row.content, updatedAt: row.updatedAt, props: row.props };
}

/** Saves through the database rows endpoint so property values ride along. */
export function useRowSaver(view: NotesViewHook, rowId: string): PageSaver {
  const { updateNote, deleteNote } = view;
  return useMemo(
    () => ({
      save: (patch) => updateNote.mutateAsync({ noteId: rowId, ...patch }),
      saving: updateNote.isPending,
      remove: () => deleteNote.mutate(rowId),
    }),
    [updateNote, deleteNote, rowId],
  );
}
