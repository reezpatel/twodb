import { useEffect } from "react";
import { NotebookPen, X } from "lucide-react";
import type { NoteProperty, NoteRecord } from "./use-notes-view";
import type { NotesViewHook } from "./use-notes-view";
import { NoteEditor } from "../editor/note-editor";

/** Slide-in editor anchored to the right edge of the screen. */
export function FloatNoteEditor({ note, columns, view, onClose }: { note: NoteRecord; columns: NoteProperty[]; view: NotesViewHook; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onClick={onClose}>
      <div
        className="bg-card border-l flex w-[36rem] max-w-full flex-col border-l shadow-xl"
        style={{ animation: "noteFloatIn 0.16s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b flex items-center gap-2 border-b px-3 py-2">
          <NotebookPen size={13} className="text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{note.preview || "(empty)"}</span>
          <button className="text-muted-foreground/70 hover:text-foreground text-xs leading-none" title="Close (Esc)" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <NoteEditor key={note.noteId} note={note} columns={columns} view={view} onClose={onClose} />
      </div>
    </div>
  );
}
