import { X } from "lucide-react";
import type { NoteProperty, NoteRecord, NotesViewHook } from "./use-notes-view";
import { NoteEditor } from "../editor/note-editor";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatValue(prop: NoteProperty, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (prop.type === "checkbox") return value ? "✓" : "✗";
  if (prop.type === "date") return new Date(String(value)).toLocaleDateString();
  return String(value);
}

export function ListView({
  notes,
  columns,
  view,
  openNoteId,
  setOpenNoteId,
}: {
  notes: NoteRecord[];
  columns: NoteProperty[];
  view: NotesViewHook;
  openNoteId: string | null;
  setOpenNoteId: (id: string | null) => void;
}) {
  const openNote = notes.find((n) => n.noteId === openNoteId) ?? null;

  return (
    <>
      <div className="bg-card/40 border-r flex w-72 shrink-0 flex-col overflow-y-auto border-r">
        {notes.map((note) => (
          <div
            key={note.noteId}
            className={cn(
              "group flex cursor-pointer flex-col gap-1 border-b border-b px-3 py-2.5 last:border-b-0 hover:bg-accent/40",
              openNoteId === note.noteId && "bg-accent/60",
            )}
            onClick={() => setOpenNoteId(note.noteId)}
          >
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 truncate text-xs">{note.preview || "(empty)"}</span>
              <button
                className="text-muted-foreground/0 group-hover:text-muted-foreground/70 hover:text-destructive text-xs leading-none"
                title="Delete note"
                onClick={(e) => {
                  e.stopPropagation();
                  view.deleteNote.mutate(note.noteId);
                  if (openNoteId === note.noteId) setOpenNoteId(null);
                }}
              >
                <X size={12} />
              </button>
            </div>
            {columns.some((prop) => note.props[prop.id] !== null && note.props[prop.id] !== undefined) && (
              <div className="flex flex-wrap gap-1">
                {columns
                  .filter((prop) => note.props[prop.id] !== null && note.props[prop.id] !== undefined)
                  .map((prop) => (
                    <Badge key={prop.id} variant="secondary" className="text-[10px] font-normal">
                      {prop.name}: {formatValue(prop, note.props[prop.id])}
                    </Badge>
                  ))}
              </div>
            )}
          </div>
        ))}
        {notes.length === 0 && <p className="text-muted-foreground/70 p-6 text-center text-xs">No notes yet.</p>}
      </div>
      {openNote ? (
        <NoteEditor key={openNote.noteId} note={openNote} columns={columns} view={view} onClose={() => setOpenNoteId(null)} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground/70 text-xs">Pick a note to edit it here.</p>
        </div>
      )}
    </>
  );
}
