import { Inbox } from "lucide-react";
import { NoteListItem } from "../../notes-old/notes-list/note-list-item";
import { noteListBodyStyles } from "./list-scene.style";
import { NoteSearchRow } from "../../notes-old/notes-list/note-search-row";

type NoteListBodyProps = {
  query: string;
  searchOpen: boolean;
  notes: Note[];
  openId: string | null;
  onOpenNote: (id: string) => void;
  onQueryChange: (query: string) => void;
};

export function NoteListBody({
  query,
  searchOpen,
  notes,
  openId,
  onOpenNote,
  onQueryChange,
}: NoteListBodyProps) {
  return <div className="shell__list"></div>;
}
