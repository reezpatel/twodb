import { X } from "lucide-react";
import type { NoteProperty, NoteRecord, NotesViewHook } from "./use-notes-view";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatValue(prop: NoteProperty, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (prop.type === "checkbox") return value ? "✓" : "✗";
  if (prop.type === "date") return new Date(String(value)).toLocaleDateString();
  return String(value);
}

/** Full-width Notion-style list — each note is a row spanning the page
 *  content width (px-4 lg:px-32, same padding as the table grid). Clicking
 *  a row opens the note via the shared openNoteId flow (side editor on
 *  desktop, full page on mobile) — no inline drawer here. */
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
  return (
    <div className="w-full">
      <div className="px-4 pb-16 lg:px-32">
        {notes.map((note) => (
          <div
            key={note.noteId}
            className={cn(
              "group flex cursor-pointer flex-col gap-1.5 border-b border-b px-2 py-3 hover:bg-accent/40",
              openNoteId === note.noteId && "bg-accent/60",
            )}
            onClick={() => setOpenNoteId(note.noteId)}
          >
            <div className="flex items-start gap-2">
              <span className="text-foreground min-w-0 flex-1 truncate text-sm">{note.title || "Untitled"}</span>
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
    </div>
  );
}