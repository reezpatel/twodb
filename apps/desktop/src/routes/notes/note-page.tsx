import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, NotebookPen } from "lucide-react";
import { useNotesView } from "./view/use-notes-view";
import { NoteEditor } from "./editor/note-editor";

/** Full-page note editor — /apps/notes/:groupId/:noteId/page. Reached from the
 * float editor's "open as page" button; renders the editor alone (no group
 * views/toolbar) with a back link to the group. */
export function NotePageScene() {
  const { groupId, noteId } = useParams<{ groupId: string; noteId: string }>();
  const navigate = useNavigate();
  const view = useNotesView(groupId ?? null);
  const notes = view.payload.data?.notes ?? [];
  const columns = view.payload.data?.columns ?? [];
  const note = notes.find((n) => n.noteId === noteId) ?? null;

  const back = () => navigate(`/apps/notes/${groupId}`);

  if (view.payload.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground animate-spin" size={18} />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <NotebookPen size={28} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">Note not found</p>
        <button className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs" onClick={back}>
          <ArrowLeft size={13} /> Back to group
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="border-b flex items-center gap-2 border-b px-3 py-2">
        <button className="text-muted-foreground/70 hover:text-foreground text-xs leading-none" title="Back to group" onClick={back}>
          <ArrowLeft size={14} />
        </button>
        <NotebookPen size={13} className="text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{note.preview || "(empty)"}</span>
      </div>
      <NoteEditor key={note.noteId} note={note} columns={columns} view={view} onClose={back} />
    </div>
  );
}
