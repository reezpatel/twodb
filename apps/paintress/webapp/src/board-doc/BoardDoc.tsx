import { MarkdownEditor } from "@twodb/editor";
import { Sparkles } from "lucide-react";
import { BoardHeader } from "../board/partials/BoardHeader";
import { paintressClient } from "../lib/paintress-client";
import { useBoardDoc } from "./hooks/useBoardDoc";
import { ConflictBanner } from "./partials/ConflictBanner";

/** Document board: one shared TwoDB rich editor whose persisted value is Markdown. */
export function BoardDoc({ boardId, name, sidebar, onRename }: { boardId: string; name: string; sidebar?: { open: boolean; onToggle(): void }; onRename(name: string): void }) {
  const d = useBoardDoc(boardId);
  const uploadImage = async (file: File) => {
    const asset = await paintressClient.uploadAsset(boardId, file);
    return paintressClient.assetUrl(asset.id);
  };

  return (
    <div className="flex h-full flex-col">
      <BoardHeader
        sidebar={sidebar}
        name={name}
        status={d.status}
        presence={[]}
        onRename={onRename}
        right={<span className="text-[11px] text-ink-muted">{d.saving ? "Saving…" : d.dirty ? "Unsaved" : "Saved"}</span>}
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
      <div className="min-h-0 flex-1 overflow-auto bg-paper">
        <MarkdownEditor
          value={d.text}
          onChange={d.onChange}
          editable={d.loaded}
          onUploadImage={uploadImage}
          placeholder="Start writing…"
          bare
          className="pa-doc-editor mx-auto min-h-full max-w-3xl px-8 py-6"
        />
      </div>
    </div>
  );
}
