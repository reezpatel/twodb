import { Columns2, Eye, Pencil, Sparkles } from "lucide-react";
import { BoardHeader } from "../board/partials/BoardHeader";
import { useBoardDoc, type DocView } from "./hooks/useBoardDoc";
import { ConflictBanner } from "./partials/ConflictBanner";
import { MarkdownEditor } from "./partials/MarkdownEditor";
import { MarkdownPreview } from "./partials/MarkdownPreview";

const VIEWS: [DocView, string, typeof Eye][] = [
  ["edit", "Edit", Pencil],
  ["split", "Split", Columns2],
  ["preview", "Preview", Eye],
];

/** Markdown board: edit on the left, rendered preview (with Mermaid diagrams) on the right. */
export function BoardDoc({ boardId, name, onRename }: { boardId: string; name: string; onRename(name: string): void }) {
  const d = useBoardDoc(boardId);
  return (
    <div className="flex h-full flex-col">
      <BoardHeader
        name={name}
        status={d.status}
        presence={[]}
        onRename={onRename}
        right={
          <>
            <span className="text-[11px] text-ink-muted">{d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved"}</span>
            <div className="flex rounded-full border border-outline p-0.5">
              {VIEWS.map(([id, label, Icon]) => (
                <button key={id} type="button" title={label} onClick={() => d.setView(id)} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] ${d.view === id ? "bg-ink text-paper" : "text-ink-muted hover:bg-paper-grid"}`}>
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
          </>
        }
      />
      {d.conflict && <ConflictBanner onTheirs={d.useTheirs} onMine={d.keepMine} />}
      {d.aiNote && (
        <div className="flex items-center gap-2 border-b border-outline bg-paper-grid px-4 py-1.5 text-[12px] text-ink-muted">
          <Sparkles className="size-3.5" /> {d.aiNote}
          <button type="button" onClick={d.dismissAiNote} className="ml-auto underline">
            dismiss
          </button>
        </div>
      )}
      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: d.view === "split" ? "1fr 1fr" : "1fr" }}>
        {d.view !== "preview" && (
          <div className={`min-h-0 overflow-auto bg-white ${d.view === "split" ? "border-r border-outline" : ""}`}>
            <MarkdownEditor value={d.text} onChange={d.onChange} readOnly={!d.loaded} />
          </div>
        )}
        {d.view !== "edit" && (
          <div className="min-h-0 overflow-auto bg-white p-8">
            <div className="mx-auto max-w-3xl">
              <MarkdownPreview markdown={d.text} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
