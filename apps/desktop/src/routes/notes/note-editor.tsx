import { Trash2 } from "lucide-react";
import { EditorContent } from "@tiptap/react";
import type { NoteProperty, NoteRecord, NotesViewHook } from "./use-notes-view";
import { useNoteEditor } from "./use-note-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export function PropertyCell({ value, prop, onCommit }: { value: unknown; prop: NoteProperty; onCommit: (value: unknown) => void }) {
  if (prop.type === "checkbox") {
    return <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onCommit(checked)} />;
  }
  if (prop.type === "select") {
    return (
      <select
        className="border-input bg-background focus:ring-ring/20 h-6 w-full cursor-pointer rounded border px-1 text-xs focus:outline-none"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onCommit(e.target.value === "" ? null : e.target.value)}
      >
        <option value="">—</option>
        {(prop.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.value}
          </option>
        ))}
      </select>
    );
  }
  if (prop.type === "number") {
    return (
      <input
        type="number"
        className="border-input bg-background h-6 w-full rounded border px-1 text-xs focus:outline-none"
        defaultValue={typeof value === "number" ? value : ""}
        placeholder="—"
        onBlur={(e) => onCommit(e.target.value === "" ? null : Number(e.target.value))}
      />
    );
  }
  if (prop.type === "date") {
    return (
      <input
        type="date"
        className="border-input bg-background h-6 w-full rounded border px-1 text-xs focus:outline-none"
        defaultValue={typeof value === "string" ? value.slice(0, 10) : ""}
        onChange={(e) => onCommit(e.target.value === "" ? null : new Date(e.target.value).toISOString())}
      />
    );
  }
  return (
    <input
      className="border-input bg-background h-6 w-full rounded border px-1 text-xs focus:outline-none"
      defaultValue={typeof value === "string" ? value : ""}
      placeholder="—"
      onBlur={(e) => onCommit(e.target.value === "" ? null : e.target.value)}
    />
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Two-panel note editor: tiptap writing surface + the group's property sheet. */
export function NoteEditor({ note, columns, view, onClose }: { note: NoteRecord; columns: NoteProperty[]; view: NotesViewHook; onClose: () => void }) {
  const editor = useNoteEditor(note, view.updateNote);

  return (
    <div className="flex min-h-0 flex-1">
      {/* main — writing surface */}
      <div className="flex min-w-0 flex-1 flex-col p-4 pb-2">
        {editor.editor && <EditorContent editor={editor.editor} className="note-editor-scroll min-h-0 flex-1 overflow-y-auto" />}
        {editor.slashPopup}
        <div className="border-t mt-2 flex items-center gap-3 border-t pt-2">
          <span className={cn("text-xs", editor.saving ? "text-muted-foreground" : "text-muted-foreground/60")}>
            {editor.saving ? "saving…" : `saved · ${relativeTime(note.updatedAt)}`}
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={editor.saveNow} disabled={!editor.editor}>
            Save now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-6 text-xs"
            onClick={() => {
              if (window.confirm("Delete this note?")) {
                view.deleteNote.mutate(note.noteId);
                onClose();
              }
            }}
          >
            <Trash2 size={12} /> Delete
          </Button>
        </div>
      </div>

      {/* right — property sheet */}
      <aside className="bg-muted/20 border-l flex w-60 shrink-0 flex-col overflow-y-auto border-l">
        <div className="text-muted-foreground/70 px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide uppercase">Properties</div>
        {columns.map((prop) => (
          <div key={prop.id} className="flex items-center gap-2 px-3 py-1.5">
            <span className="text-muted-foreground w-20 shrink-0 truncate text-xs">{prop.name}</span>
            <div className="min-w-0 flex-1">
              <PropertyCell value={note.props[prop.id]} prop={prop} onCommit={(value) => editor.setProp(prop.id, value)} />
            </div>
          </div>
        ))}
        {columns.length === 0 && <p className="text-muted-foreground/60 px-3 py-2 text-xs">No properties — add one from the toolbar.</p>}
      </aside>
    </div>
  );
}
