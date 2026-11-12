import { useSessionFiles } from "./hooks/useSessionSide.js";
import { cn } from "../../lib/cn.js";

/** Simple two-pane editor: file tree (find -maxdepth 3) + textarea. */
export function EditorScreen(props: { sessionId: string }) {
  const files = useSessionFiles(props.sessionId);
  return (
    <div className="flex h-full min-h-0">
      <div className="w-56 shrink-0 overflow-y-auto border-r border-outline py-2">
        {files.files.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => void files.open(f)}
            className={cn(
              "block w-full truncate px-3 py-0.5 text-left font-mono text-[11px]",
              f === files.openPath ? "bg-surface-muted text-ink" : "text-ink-muted hover:text-ink",
            )}
            title={f}
          >
            {f}
          </button>
        ))}
        {files.files.length === 0 ? <p className="px-3 text-[11px] text-ink-muted">no files</p> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {files.openPath ? (
          <>
            <div className="flex items-center gap-2 border-b border-outline px-3 py-1.5">
              <span className="truncate font-mono text-[12px]">{files.openPath}</span>
              {files.dirty ? <span className="text-[10px] text-warning">unsaved</span> : null}
              <button
                type="button"
                className="ml-auto rounded border border-outline px-2 py-0.5 text-[11px] hover:bg-surface-muted disabled:opacity-40"
                disabled={!files.dirty}
                onClick={() => void files.save()}
              >
                Save (⌘S)
              </button>
            </div>
            <textarea
              value={files.content}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none bg-paper px-3 py-2 font-mono text-[12px] leading-relaxed outline-none"
              onChange={(e) => files.setContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                  e.preventDefault();
                  void files.save();
                }
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-ink-muted">Pick a file to edit</div>
        )}
      </div>
    </div>
  );
}
