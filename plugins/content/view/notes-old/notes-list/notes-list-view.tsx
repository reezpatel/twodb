import type { NotesViewProps } from "../types";
import { NoteListBody } from "../../scenes/list-scene/note-list-body";

export function NotesListView({
  query,
  searchOpen,
  notes,
  openId,
  onOpenNote,
  onQueryChange,
}: NotesViewProps) {
  return (
    <NoteListBody
      query={query}
      searchOpen={searchOpen}
      notes={notes}
      openId={openId}
      onOpenNote={onOpenNote}
      onQueryChange={onQueryChange}
    />
  );
}
