import { Plus } from "lucide-react";
import type { NoteProperty, NoteRecord, NotesViewHook } from "./use-notes-view";

export function KanbanView({
  notes,
  columns: _columns,
  view,
  groupByProp,
  setOpenNoteId,
}: {
  notes: NoteRecord[];
  columns: NoteProperty[];
  view: NotesViewHook;
  groupByProp: NoteProperty | null;
  setOpenNoteId: (id: string | null) => void;
}) {
  if (!groupByProp) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground/70 text-xs">
          Add a <span className="font-medium">select</span> property and pick it in “Group by…” to build the board.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto p-3">
      {[...(groupByProp.options ?? []), null].map((option) => {
        const value = option?.value ?? null;
        const bucket = notes.filter((n) => (n.props[groupByProp.id] ?? null) === value);
        return (
          <div
            key={option?.value ?? "unassigned"}
            className="bg-muted/40 flex w-56 shrink-0 flex-col gap-2 rounded-lg p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const noteId = e.dataTransfer.getData("text/plain");
              if (noteId) view.updateNote.mutate({ noteId, props: { [groupByProp.id]: value } });
            }}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold">{option?.value ?? "Unassigned"}</span>
              <button
                className="text-muted-foreground/70 hover:text-foreground text-xs"
                title="Add note"
                onClick={() => view.createNote.mutate({ text: "", props: { [groupByProp.id]: value } })}
              >
                <Plus size={12} />
              </button>
            </div>
            {bucket.map((note) => (
              <div
                key={note.noteId}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", note.noteId)}
                className="bg-card cursor-pointer rounded-md border p-2 text-xs shadow-xs hover:bg-accent/40"
                onClick={() => setOpenNoteId(note.noteId)}
              >
                <span className="block truncate">{note.preview || "(empty)"}</span>
              </div>
            ))}
            {bucket.length === 0 && <p className="text-muted-foreground/40 px-1 py-2 text-center text-[10px]">drop here</p>}
          </div>
        );
      })}
    </div>
  );
}
