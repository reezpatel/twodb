import { useRef, useState } from "react";
import { ImageIcon, Smile, Trash2 } from "lucide-react";
import { EditorContent } from "@tiptap/react";
import { Resizable } from "re-resizable";
import type { NoteProperty, NoteRecord, NotesViewHook } from "../view/use-notes-view";
import { useNoteEditor } from "./use-note-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Inline editor — kept for the note-editor property sheet where floating UI isn't appropriate. */
export function PropertyCell({ value, prop, onCommit }: { value: unknown; prop: NoteProperty; onCommit: (value: unknown) => void }) {
  if (prop.type === "checkbox") {
    return <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onCommit(checked)} />;
  }
  if (prop.type === "select") {
    return (
      <select
        className="border-input bg-background focus:ring-ring/20 h-6 w-full cursor-pointer border px-1 text-xs focus:outline-none"
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

/** twodb:// asset uri → org-scoped preview URL (served by the notes routes). */
function assetPreviewUrl(uri: string): string | null {
  const id = /^twodb:\/\/[^/]+\/([A-Za-z0-9-_.]+)$/.exec(uri)?.[1];
  return id ? `/api/notes/assets/${id}` : null;
}

/** Cover + icon controls — Notion-style. Uploads land in the note_assets
 * storage destination; the uri is kept in the note content JSON. */
function PageHeader({
  note,
  view,
  decorations,
  setDecorations,
  onTitleKeyDown,
  onTitleChange,
  titleRef,
}: {
  note: NoteRecord;
  view: NotesViewHook;
  decorations: { icon: string | null; cover: string | null };
  setDecorations: (patch: { icon?: string | null; cover?: string | null }) => void;
  onTitleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onTitleChange: (value: string) => void;
  titleRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const coverInput = useRef<HTMLInputElement>(null);
  const iconInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File, apply: (uri: string) => void) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/notes/groups/${view.groupId}/notes/${note.noteId}/assets`, { method: "POST", body, credentials: "include" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "upload failed");
      }
      const asset = (await res.json()) as { uri: string };
      apply(asset.uri);
    } catch (e) {
      alert(
        `Upload failed: ${(e as Error).message}${(e as Error).message.includes("not_configured") ? " — configure Notes Storage in Settings → Storage" : ""}`,
      );
    } finally {
      setUploading(false);
    }
  };

  const pickCover = () => coverInput.current?.click();
  const coverUrl = decorations.cover ? assetPreviewUrl(decorations.cover) : null;
  const iconUrl = decorations.icon ? assetPreviewUrl(decorations.icon) : null;

  return (
    <div className="group/header flex flex-col gap-3">
      {/* cover */}
      {coverUrl ? (
        <div className="group/cover relative -mx-4 -mt-4">
          <img src={coverUrl} alt="" className="h-44 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 hidden justify-end gap-1 p-2 group-hover/cover:flex">
            <Button variant="secondary" size="sm" className="h-6 text-xs" onClick={pickCover} disabled={uploading}>
              <ImageIcon size={12} /> Change cover
            </Button>
            <Button variant="secondary" size="sm" className="h-6 text-xs" onClick={() => setDecorations({ cover: null })}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end opacity-0 transition-opacity group-hover/header:opacity-100">
          <Button variant="ghost" size="sm" className="text-muted-foreground h-6 text-xs" onClick={pickCover} disabled={uploading}>
            <ImageIcon size={12} /> Add cover
          </Button>
        </div>
      )}
      <input
        ref={coverInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) void upload(e.target.files[0], (uri) => setDecorations({ cover: uri }));
          e.target.value = "";
        }}
      />

      {/* icon + title row */}
      <div className="flex items-start gap-2">
        <div className="group/icon relative shrink-0">
          <input
            ref={iconInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0], (uri) => setDecorations({ icon: uri }));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            title={iconUrl ? "Remove icon" : "Add icon"}
            className={cn(
              "flex size-10 items-center justify-center rounded-md text-3xl leading-none",
              !iconUrl && "text-muted-foreground/40 hover:bg-accent hover:text-muted-foreground opacity-0 group-hover/icon:opacity-100",
            )}
            onClick={() => (iconUrl ? setDecorations({ icon: null }) : iconInput.current?.click())}
          >
            {iconUrl ? <img src={iconUrl} alt="" className="size-9 rounded-md object-contain" /> : <Smile size={20} />}
          </button>
        </div>
        <textarea
          ref={titleRef}
          rows={1}
          placeholder="Untitled"
          defaultValue={note.title}
          className="min-h-9 w-full flex-1 resize-none overflow-hidden border-none bg-transparent text-xl font-bold outline-none placeholder:text-muted-foreground/40"
          onKeyDown={onTitleKeyDown}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>
    </div>
  );
}

/** Two-panel note editor: tiptap writing surface + the group's property sheet.
 * The property sheet is resizable via its left edge (persisted per-app).
 * Notion-style page header: cover image, icon, and an inline title that sits
 * above the tiptap doc — Enter in the title moves focus into the editor.
 * `showProperties={false}` hides the sheet (side-by-side layouts that already
 * show properties in the table beside the editor). */
export function NoteEditor({
  note,
  columns,
  view,
  onClose,
  showProperties = true,
}: {
  note: NoteRecord;
  columns: NoteProperty[];
  view: NotesViewHook;
  onClose: () => void;
  showProperties?: boolean;
}) {
  const editor = useNoteEditor(note, view.updateNote);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [decorations, setDecorationsState] = useState(() => {
    const raw = (note.content as Record<string, unknown>) ?? {};
    return {
      icon: typeof raw.icon === "string" ? raw.icon : null,
      cover: typeof raw.cover === "string" ? raw.cover : null,
    };
  });

  // auto-grow the title textarea
  const autosizeTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const persistTitle = (value: string) => {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => view.updateNote.mutate({ noteId: note.noteId, title: value.slice(0, 200) }), 600);
  };

  const setDecorations = (patch: { icon?: string | null; cover?: string | null }) => {
    setDecorationsState((d) => ({ ...d, ...patch }));
    editor.setDecorations(patch);
  };

  // Enter in the title focuses the editor body (Notion behavior); Backspace
  // on an empty title falls through to the editor too.
  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    autosizeTitle();
    if (e.key === "Enter") {
      e.preventDefault();
      editor.editor?.commands.focus("start");
    }
    if (e.key === "Backspace" && !e.currentTarget.value) {
      e.preventDefault();
      editor.editor?.commands.focus("start");
    }
  };

  // Persisted property-sheet width (re-resizable left-edge handle).
  const [sheetWidth, setSheetWidth] = useState(() => {
    const raw = Number(localStorage.getItem("twodb.notePropSheetWidth"));
    return Number.isFinite(raw) && raw >= 180 && raw <= 480 ? raw : 240;
  });
  const persistSheetWidth = (w: number) => {
    const clamped = Math.min(480, Math.max(180, w));
    setSheetWidth(clamped);
    localStorage.setItem("twodb.notePropSheetWidth", String(Math.round(clamped)));
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* main — writing surface. The scroll container spans the full column so
          the scrollbar sits at the panel edge; the prose column itself stays
          narrow and centered inside it. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="note-editor-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 pt-4">
            <PageHeader
              note={note}
              view={view}
              decorations={decorations}
              setDecorations={setDecorations}
              onTitleKeyDown={onTitleKeyDown}
              onTitleChange={(v) => {
                autosizeTitle();
                persistTitle(v);
              }}
              titleRef={titleRef}
            />
            {editor.editor && <EditorContent editor={editor.editor} className="mt-4" />}
            {editor.slashPopup}
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl px-4 pb-2">
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
      </div>

      {/* right — property sheet (resizable via its left edge); hidden in
          side-by-side layouts where the table already shows properties. */}
      {showProperties && (
        <Resizable
          size={{ width: sheetWidth, height: "100%" }}
          minWidth={180}
          maxWidth={480}
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
          onResizeStop={(_e, _dir, _ref, delta) => persistSheetWidth(sheetWidth + delta.width)}
          className="bg-muted/20 shrink-0"
        >
          <aside className="flex h-full min-h-0 w-full flex-col overflow-y-auto border-l">
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
        </Resizable>
      )}
    </div>
  );
}
