import { useRef } from "react";
import { ImageIcon, RotateCcw, Smile, Trash2 } from "lucide-react";
import { BlockEditor, type Editor } from "@twodb/editor";
import { Dialog, DialogContent, DialogTitle } from "@twodb/blocks";
import type { RecordDetail } from "@shared/model";
import { cn } from "@twodb/blocks";
import { useNavigate } from "react-router";
import { api } from "../lib/api";
import { useGarden } from "../lib/queries";
import { Popover } from "../ui/Popover";
import { EmojiPicker, randomEmoji } from "../ui/EmojiPicker";
import { useDocEditor } from "./hooks/useDocEditor";
import { PageCover, COVER_PRESETS } from "./partials/PageCover";
import { PageTitle, type PageTitleHandle } from "./partials/PageTitle";
import { PropertiesPanel } from "./partials/PropertiesPanel";
import { Backlinks } from "./partials/Backlinks";
import { DatabasePicker } from "../database/fields/config/DatabasePicker";

/** A note: cover, icon, title, properties, block editor, backlinks. Used full-page and inside the peek view. */
export function DocEditor({ record, mode = "page" }: { record: RecordDetail; mode?: "page" | "peek" }) {
  const garden = useGarden();
  const navigate = useNavigate();
  const doc = useDocEditor(record);
  const titleRef = useRef<PageTitleHandle>(null);
  // Enter in the title can beat editor creation — remember the intent and focus once it exists.
  const pendingFocus = useRef(false);
  // synchronous (TipTap's focus() waits a frame, letting fast keystrokes land in the title)
  const focusStart = (e: Editor) => {
    e.commands.setTextSelection(1);
    e.view.focus();
  };
  const focusEditor = () => {
    if (doc.editorRef.current) focusStart(doc.editorRef.current);
    else {
      pendingFocus.current = true;
      (document.activeElement as HTMLElement | null)?.blur();
    }
  };
  const trashed = !!record.deletedAt;
  const editable = !trashed;
  const full = !!record.config.fullWidth && mode === "page";

  const setDecor = (b: { icon?: string | null; cover?: string | null }) => void garden.patchRecord(record.id, b);
  const uploadCover = async (f: File) => setDecor({ cover: (await api.upload(f, record.id)).url });

  return (
    <div className="pb-10">
      {trashed ? (
        <div className="flex items-center justify-center gap-3 bg-pin/90 px-4 py-2 text-[13px] font-medium text-paper">
          This page is in Trash.
          <button type="button" onClick={() => void garden.restore(record.id)} className="flex items-center gap-1 rounded-md border border-paper/60 px-2 py-0.5 hover:bg-paper/10">
            <RotateCcw size={13} /> Restore
          </button>
          <button
            type="button"
            onClick={() => window.confirm("Delete permanently? This cannot be undone.") && void garden.deleteForever(record.id).then(() => navigate("/trash"))}
            className="flex items-center gap-1 rounded-md border border-paper/60 px-2 py-0.5 hover:bg-paper/10"
          >
            <Trash2 size={13} /> Delete forever
          </button>
        </div>
      ) : null}
      {record.cover ? <PageCover cover={record.cover} editable={editable} onChange={(c) => setDecor({ cover: c })} onUpload={uploadCover} /> : null}

      <div className={cn("mx-auto w-full px-6 sm:px-16", full ? "max-w-none" : mode === "peek" ? "max-w-[860px]" : "max-w-[880px]")}>
        <div className={cn("group/head", record.cover ? (record.icon ? "-mt-10" : "pt-6") : mode === "peek" ? "pt-8" : "pt-16")}>
          {record.icon ? (
            <Popover
              trigger={
                <button type="button" disabled={!editable} className="relative mb-2 flex size-[72px] items-center justify-center rounded-lg text-[60px] leading-none hover:bg-ink/[0.05]">
                  {record.icon}
                </button>
              }
            >
              <EmojiPicker onPick={(icon) => setDecor({ icon })} onRemove={() => setDecor({ icon: null })} />
            </Popover>
          ) : null}
          {editable ? (
            <div className="mb-1 flex h-7 gap-1 opacity-0 transition-opacity group-hover/head:opacity-100">
              {!record.icon ? (
                <button type="button" onClick={() => setDecor({ icon: randomEmoji() })} className="flex items-center gap-1 rounded-md px-1.5 text-[13px] text-ink-muted hover:bg-ink/[0.05]">
                  <Smile size={14} /> Add icon
                </button>
              ) : null}
              {!record.cover ? (
                <button type="button" onClick={() => setDecor({ cover: COVER_PRESETS[Math.floor(Math.random() * COVER_PRESETS.length)] })} className="flex items-center gap-1 rounded-md px-1.5 text-[13px] text-ink-muted hover:bg-ink/[0.05]">
                  <ImageIcon size={14} /> Add cover
                </button>
              ) : null}
            </div>
          ) : null}
          <PageTitle
            ref={titleRef}
            value={record.title}
            readOnly={!editable}
            size={mode}
            onChange={(title) => void garden.patchRecord(record.id, { title })}
            autoFocus={editable && !record.title && mode === "page"}
            onEnter={focusEditor}
          />
          <PropertiesPanel record={record} defaultOpen={mode === "peek" || (record.fields ?? []).length <= 6} />
        </div>

        <div className="mt-5">
          <BlockEditor
            key={record.id}
            initialContent={(record.content as never) ?? null}
            onChange={doc.onChange}
            editable={editable}
            autofocus={false}
            placeholder="Type '/' for commands, '@' to link a page"
            onExitTop={() => titleRef.current?.focus()}
            onReady={(e) => {
              doc.editorRef.current = e;
              if (import.meta.env.DEV) (window as unknown as { __gardenEditor: unknown }).__gardenEditor = e;
              if (pendingFocus.current) {
                pendingFocus.current = false;
                focusStart(e);
              }
            }}
            {...doc.host}
          />
        </div>
        <Backlinks id={record.id} />
      </div>

      <Dialog open={!!doc.linkPicker} onOpenChange={(o) => !o && doc.closeLinkPicker()}>
        <DialogContent className="w-auto max-w-none p-0">
          <DialogTitle className="px-3 pt-3 text-[14px]">Linked view of database</DialogTitle>
          <DatabasePicker onPick={(id) => void doc.insertLinkedView(id)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

