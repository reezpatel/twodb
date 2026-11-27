import { useMemo, useState } from "react";
import { ChevronDown, GitBranch, RefreshCw } from "lucide-react";
import { cn } from "../../../lib/cn.js";
import { FileTree } from "../../../components/ui/file-tree.js";
import { buildItems } from "../gitTree.js";
import type { GitInfo } from "../hooks/useSessionSide.js";

function Counts(props: { additions: number | null; deletions: number | null; className?: string }) {
  return (
    <span className={cn("flex shrink-0 gap-2 font-mono text-xs font-normal tabular-nums", props.className)}>
      {props.additions !== null ? <span className="text-success">+{props.additions}</span> : null}
      {props.deletions !== null ? <span className="text-destructive">−{props.deletions}</span> : null}
    </span>
  );
}

/** Legacy "Git Summary": branch + ahead/behind, changed files grouped by folder with line counts. */
export function GitSection(props: { git: GitInfo | null; refreshing: boolean; onRefresh: () => void }) {
  const { git } = props;
  const [open, setOpen] = useState(true);
  const files = git?.files ?? [];
  const items = useMemo(() => buildItems(files), [files]);
  const [selected, setSelected] = useState<string>();
  const isRepo = !!git && git.git !== false;
  const showTotals = isRepo && files.length > 0;
  const title = showTotals ? `${files.length} changed ${files.length === 1 ? "file" : "files"}` : "Git Summary";

  return (
    <div data-slot="git-section" className="border-b last:border-b-0">
      <div className={cn("flex items-center bg-surface-muted/40", open && "border-b border-outline")}>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left text-[13px] font-medium hover:bg-surface-muted/70">
          <ChevronDown size={16} className={cn("shrink-0 text-ink-muted transition-transform", !open && "-rotate-90")} />
          <span className="truncate">{title}</span>
          {showTotals ? <Counts additions={git!.additions ?? 0} deletions={git!.deletions ?? 0} className="ml-auto" /> : null}
        </button>
        {isRepo ? (
          <button type="button" title="Refresh" aria-label="Refresh" onClick={props.onRefresh} className="mr-2 flex size-6 items-center justify-center rounded text-ink-muted hover:bg-surface-muted hover:text-ink">
            <RefreshCw size={12} className={props.refreshing ? "animate-spin" : undefined} />
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="pb-2">
          {!git ? (
            <p className="px-3 py-1 text-sm text-ink-muted">loading…</p>
          ) : !isRepo ? (
            <p className="px-3 py-1 text-sm text-ink-muted">not a git repository</p>
          ) : (
            <>
              <div className="flex min-h-7 items-center gap-2 px-3 text-xs">
                <GitBranch size={14} className="shrink-0 text-ink-muted" />
                <span className="truncate font-mono">{git.branch}</span>
                {git.ahead != null ? (
                  <span className={cn("shrink-0 font-mono", git.ahead > 0 ? "text-success" : "text-ink-muted")}>
                    {git.ahead > 0 ? `↑${git.ahead}` : "0"}
                    {git.behind != null && git.behind > 0 ? ` ↓${git.behind}` : ""}
                  </span>
                ) : null}
              </div>
              {files.length === 0 ? <p className="px-3 py-1 text-sm text-ink-muted">No changes — working tree clean.</p> : null}
              {files.length > 0 ? <FileTree bare title="Changed files" items={items} selectedId={selected} onSelect={setSelected} className="px-1" /> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
