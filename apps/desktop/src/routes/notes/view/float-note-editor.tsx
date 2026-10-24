import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Expand, NotebookPen, X } from "lucide-react";
import { Resizable } from "re-resizable";
import type { NoteProperty, NoteRecord, NotesViewHook } from "./use-notes-view";
import { NoteEditor } from "../editor/note-editor";
import { rowPage, useRowSaver } from "../editor/row-saver";

/** Side-editor size bounds: 600–2800px, 1200px default; the panel can never
 *  exceed 80% of the viewport so the table beside it stays usable. */
const MAX_EDITOR_WIDTH = 2800;
const MIN_EDITOR_WIDTH = 600;
const DEFAULT_EDITOR_WIDTH = 1200;

/** 80% of the viewport, still capped at MAX_EDITOR_WIDTH. */
function viewportCap() {
  return Math.min(MAX_EDITOR_WIDTH, Math.round(window.innerWidth * 0.8));
}

/** Side-by-side editor docked to the right edge — resizable via its left edge
 * (persisted px width, default 1200px, capped at 80% of the screen). Properties
 * are hidden: the table/kanban beside it already shows them. Mobile never
 * renders this — the provider routes note opens to the full page instead. */
export function FloatNoteEditor({ note, columns, view, onClose }: { note: NoteRecord; columns: NoteProperty[]; view: NotesViewHook; onClose: () => void }) {
  const navigate = useNavigate();
  const saver = useRowSaver(view, note.noteId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Persisted editor width — 800px default, never more than 80% of the screen.
  const [editorWidth, setEditorWidth] = useState(() => {
    const raw = Number(localStorage.getItem("twodb.noteSideEditorWidth"));
    if (Number.isFinite(raw) && raw >= MIN_EDITOR_WIDTH) return Math.min(raw, viewportCap());
    return DEFAULT_EDITOR_WIDTH;
  });
  const persistWidth = (w: number) => {
    const clamped = Math.min(viewportCap(), Math.max(MIN_EDITOR_WIDTH, w));
    setEditorWidth(clamped);
    localStorage.setItem("twodb.noteSideEditorWidth", String(Math.round(clamped)));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onClick={onClose}>
      <div className="flex h-full" style={{ animation: "noteFloatIn 0.16s ease-out" }} onClick={(e) => e.stopPropagation()}>
        <Resizable
          size={{ width: editorWidth, height: "100%" }}
          minWidth={MIN_EDITOR_WIDTH}
          maxWidth={viewportCap()}
          enable={{ left: true }}
          handleStyles={{ left: { width: "5px", left: "-2px", height: "100%", cursor: "col-resize" } }}
          handleComponent={{
            left: (
              <div
                className="bg-border hover:bg-primary/60 absolute inset-y-0 left-0 z-10 w-1 -translate-x-1/2 cursor-col-resize transition-colors"
                title="Drag to resize"
              />
            ),
          }}
          onResizeStop={(_e, _dir, _ref, delta) => persistWidth(editorWidth + delta.width)}
          className="bg-card border-l flex shrink-0 flex-col border-l shadow-xl"
        >
          <div className="border-b flex items-center gap-2 border-b px-3 py-2">
            <NotebookPen size={13} className="text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{note.title || "Untitled"}</span>
            <button
              className="text-muted-foreground/70 hover:text-foreground text-xs leading-none"
              title="Open as page"
              aria-label="Open as page"
              onClick={() => navigate(`/apps/notes/${note.noteId}`)}
            >
              <Expand size={14} />
            </button>
            <button className="text-muted-foreground/70 hover:text-foreground text-xs leading-none" title="Close (Esc)" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
          <NoteEditor key={note.noteId} page={rowPage(note)} saver={saver} columns={columns} onClose={onClose} />
        </Resizable>
      </div>
    </div>
  );
}
