import { useRef, useState, type ReactNode } from "react";
import { ImageIcon, Smile, Trash2 } from "lucide-react";
import { EditorContent } from "@tiptap/react";
import { Resizable } from "re-resizable";
import type { NoteProperty } from "../view/use-notes-view";
import { assetPreviewUrl, uploadNodeAsset } from "../use-notes-scene";
import { useNoteEditor, type EditablePage, type PageSaver } from "./use-note-editor";
import type { SlashContext } from "./slash-command";
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

/** Cover + icon + title — Notion-style. Uploads land in the note_assets
 * storage destination; uris are saved on the node (icon/cover columns). */
function PageHeader({
  page,
  saver,
  onTitleKeyDown,
  onTitleChange,
  titleRef,
}: {
  page: EditablePage;
  saver: PageSaver;
  onTitleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onTitleChange: (value: string) => void;
  titleRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const coverInput = useRef<HTMLInputElement>(null);
  const iconInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // optimistic decorations — the saver's refetch catches up
  const [decor, setDecor] = useState({ icon: page.icon, cover: page.cover });

  const apply = (patch: { icon?: string | null; cover?: string | null }) => {
    setDecor((d) => ({ ...d, ...patch }));
    void saver.save(patch);
  };
  const upload = async (file: File, key: "icon" | "cover") => {
    setUploading(true);
    try {
      apply({ [key]: await uploadNodeAsset(page.id, file) });
    } catch (e) {
      alert(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };
  const onPick = (key: "icon" | "cover") => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) void upload(e.target.files[0], key);
    e.target.value = "";
  };

  const coverUrl = assetPreviewUrl(decor.cover);
  const iconUrl = assetPreviewUrl(decor.icon);

  return (
    <div className="group/header flex flex-col gap-2">
      {coverUrl && (
        <div className="group/cover relative -mx-4 -mt-4 mb-2">
          <img src={coverUrl} alt="" className="h-44 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 hidden justify-end gap-1 p-2 group-hover/cover:flex">
            <Button variant="secondary" size="sm" className="h-6 text-xs" onClick={() => coverInput.current?.click()} disabled={uploading}>
              <ImageIcon size={12} /> Change cover
            </Button>
            <Button variant="secondary" size="sm" className="h-6 text-xs" onClick={() => apply({ cover: null })}>
              Remove
            </Button>
          </div>
        </div>
      )}
      {iconUrl && (
        <button type="button" title="Remove icon" className="size-16 shrink-0" onClick={() => apply({ icon: null })}>
          <img src={iconUrl} alt="" className="size-16 rounded-md object-contain" />
        </button>
      )}
      {/* add-chips float in on hover, only for what's missing */}
      <div className="flex h-6 gap-1 opacity-0 transition-opacity group-hover/header:opacity-100">
        {!iconUrl && (
          <Button variant="ghost" size="sm" className="text-muted-foreground h-6 gap-1 text-xs" onClick={() => iconInput.current?.click()} disabled={uploading}>
            <Smile size={12} /> Add icon
          </Button>
        )}
        {!coverUrl && (
          <Button variant="ghost" size="sm" className="text-muted-foreground h-6 gap-1 text-xs" onClick={() => coverInput.current?.click()} disabled={uploading}>
            <ImageIcon size={12} /> Add cover
          </Button>
        )}
      </div>
      <textarea
        ref={titleRef}
        rows={1}
        placeholder="Untitled"
        defaultValue={page.title}
        className="min-h-10 w-full resize-none overflow-hidden border-none bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/40"
        onKeyDown={onTitleKeyDown}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label="Page title"
      />
      <input ref={iconInput} type="file" accept="image/*" className="hidden" onChange={onPick("icon")} />
      <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={onPick("cover")} />
    </div>
  );
}

/** Page editor: header (cover/icon/title) + tiptap body, optional property
 * sheet (database rows). `emptyActions` renders under the body while the
 * page is empty (e.g. "Turn into database"). */
export function NoteEditor({
  page,
  saver,
  columns = [],
  showProperties = false,
  emptyActions,
  footer,
  slash,
  onEmbedsChanged,
  onClose,
}: {
  page: EditablePage;
  saver: PageSaver;
  columns?: NoteProperty[];
  showProperties?: boolean;
  emptyActions?: ReactNode;
  /** Rendered after the body (e.g. links to sub-pages). */
  footer?: ReactNode;
  slash?: SlashContext;
  onEmbedsChanged?: () => void;
  onClose?: () => void;
}) {
  const editor = useNoteEditor(page, saver, { slash, onEmbedsChanged });
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autosizeTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const persistTitle = (value: string) => {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => void saver.save({ title: value.slice(0, 200) }), 500);
  };

  // Enter in the title focuses the body (Notion behavior).
  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    autosizeTitle();
    if (e.key === "Enter") {
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
      <div className="flex min-w-0 flex-1 flex-col">
        {/* scroll container spans the column (scrollbar at the panel edge);
            the prose column stays narrow and centered */}
        <div className="note-editor-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 pt-12 pb-24 lg:px-12">
            <PageHeader
              page={page}
              saver={saver}
              onTitleKeyDown={onTitleKeyDown}
              onTitleChange={(v) => {
                autosizeTitle();
                persistTitle(v);
              }}
              titleRef={titleRef}
            />
            {editor.editor && <EditorContent editor={editor.editor} className="mt-2" />}
            {editor.isEmpty && emptyActions}
            {footer}
            {editor.slashPopup}
          </div>
        </div>
        <div className="mx-auto w-full max-w-4xl px-4 pb-2 lg:px-12">
          <div className="flex items-center gap-3 border-t pt-2">
            <span className={cn("text-xs", editor.saving ? "text-muted-foreground" : "text-muted-foreground/60")}>
              {editor.saving ? "saving…" : `saved · ${relativeTime(page.updatedAt)}`}
            </span>
            {saver.remove && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive ml-auto h-6 text-xs"
                onClick={() => {
                  if (window.confirm("Move this page to trash?")) {
                    saver.remove?.();
                    onClose?.();
                  }
                }}
              >
                <Trash2 size={12} /> Delete
              </Button>
            )}
          </div>
        </div>
      </div>

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
                  <PropertyCell value={page.props?.[prop.id]} prop={prop} onCommit={(value) => editor.setProp(prop.id, value)} />
                </div>
              </div>
            ))}
            {columns.length === 0 && <p className="text-muted-foreground/60 px-3 py-2 text-xs">No properties yet — add one from the database.</p>}
          </aside>
        </Resizable>
      )}
    </div>
  );
}
