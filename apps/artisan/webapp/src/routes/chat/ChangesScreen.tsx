import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Columns2,
  FileDiff as FileDiff_,
  FileMinus,
  FilePen,
  FilePlus,
  FileQuestion,
  Folder,
  GitBranch,
  Rows2,
  RefreshCw,
  Search,
  WrapText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useSessionSide, type GitInfo } from "./hooks/useSessionSide.js";
import { apiFetch } from "../../lib/artisan-client.js";
import { FileDiff, type DiffHunk } from "../../components/ui/file-diff.js";
import { FileTree } from "../../components/ui/file-tree.js";
import { buildItems, type GitFile, type Kind } from "./gitTree.js";


const KIND: Record<Kind, { icon: LucideIcon; tone: string; label: string }> = {
  modified: { icon: FilePen, tone: "text-warning", label: "Modified" },
  added: { icon: FilePlus, tone: "text-success", label: "Added" },
  deleted: { icon: FileMinus, tone: "text-destructive", label: "Deleted" },
  renamed: { icon: FileDiff_, tone: "text-info", label: "Renamed" },
  untracked: { icon: FileQuestion, tone: "text-ink-muted", label: "Untracked" },
};
const BY_LETTER: Record<string, Kind> = { M: "modified", A: "added", D: "deleted", R: "renamed", C: "added", "?": "untracked", U: "untracked" };
const kindOf = (f: GitFile): Kind => BY_LETTER[f.status.slice(0, 1)] ?? "modified";

// ---- diff parsing ---------------------------------------------------------------

function parseHunks(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let cur: DiffHunk | null = null;
  let a = 0;
  let b = 0;
  let prevOldEnd = 1;
  for (const raw of diff.split("\n")) {
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (m) {
      a = Number(m[1]);
      b = Number(m[2]);
      cur = { id: `h${hunks.length}`, header: raw, skipped: Math.max(0, a - prevOldEnd), lines: [] };
      hunks.push(cur);
    } else if (!cur) {
      continue; // file headers (diff --git, index, ---, +++)
    } else if (raw.startsWith("+")) cur.lines.push({ type: "addition", content: raw.slice(1), newNumber: b++ });
    else if (raw.startsWith("-")) cur.lines.push({ type: "deletion", content: raw.slice(1), oldNumber: a++ });
    else if (raw.startsWith("\\")) continue; // "\ No newline at end of file"
    else {
      cur.lines.push({ type: "context", content: raw.slice(1), oldNumber: a++, newNumber: b++ });
    }
    if (cur) prevOldEnd = a;
  }
  // drop the trailing empty context line produced by the final newline
  const last = hunks[hunks.length - 1];
  const ll = last?.lines[last.lines.length - 1];
  if (last && ll && ll.type === "context" && ll.content === "") last.lines.pop();
  return hunks;
}

// ---- small pieces ----------------------------------------------------------------

function Counts(props: { additions: number | null; deletions: number | null }) {
  return (
    <span className="flex shrink-0 gap-1.5 font-mono text-[10px] tabular-nums">
      {props.additions ? <span className="text-success">+{props.additions}</span> : null}
      {props.deletions ? <span className="text-destructive">−{props.deletions}</span> : null}
    </span>
  );
}

function IconButton(props: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        "flex size-6 items-center justify-center rounded text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-40",
        props.active && "bg-surface-muted text-ink",
      )}
    >
      {props.children}
    </button>
  );
}

// ---- screen ----------------------------------------------------------------------

/**
 * Changes view: filterable, folder-grouped file list (status, per-file +/−) on the
 * left; the selected file's diff on the right with line numbers, unified/split
 * modes, word-wrap, prev/next file (j/k) and copy-path.
 */
export function ChangesScreen(props: { sessionId: string }) {
  const side = useSessionSide(props.sessionId);
  const git = side.git;
  const files = useMemo(() => git?.files ?? [], [git]);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [mode, setMode] = useState<"unified" | "split">(() => (localStorage.getItem("artisan.diff.mode") === "split" ? "split" : "unified"));
  const [wrap, setWrap] = useState(false);
  
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? files.filter((f) => f.path.toLowerCase().includes(q)) : files;
  }, [files, filter]);

  const items = useMemo(() => buildItems(visible), [visible]);

  // keep selection valid as the file list changes
  useEffect(() => {
    if (files.length === 0) setSelected(null);
    else if (!selected || !files.some((f) => f.path === selected)) setSelected(files[0].path);
  }, [files, selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`/sessions/${props.sessionId}/diff?path=${encodeURIComponent(selected)}`)
      .then((r) => (r.ok ? r.json() : { diff: "" }))
      .then((d: { diff?: string }) => !cancelled && setDiff(d.diff ?? ""))
      .catch(() => !cancelled && setDiff(""))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected, props.sessionId]);

  const hunks = useMemo(() => (diff ? parseHunks(diff) : []), [diff]);
  const current = files.find((f) => f.path === selected);
  const idx = visible.findIndex((f) => f.path === selected);

  const go = useCallback(
    (delta: number) => {
      if (visible.length === 0) return;
      const next = visible[(Math.max(idx, 0) + delta + visible.length) % visible.length];
      setSelected(next.path);
    },
    [visible, idx],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      go(1);
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      go(-1);
    }
  };

  const setViewMode = (m: "unified" | "split") => {
    setMode(m);
    localStorage.setItem("artisan.diff.mode", m);
  };

  const isRepo = !!git && git.git !== false;

  return (
    <div className="flex h-full min-h-0 outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      {/* file list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-outline">
        <div className="flex shrink-0 items-center gap-2 border-b border-outline px-3 py-2">
          <span className="text-[13px] font-medium">{files.length > 0 ? `${files.length} changed ${files.length === 1 ? "file" : "files"}` : "Changes"}</span>
          {isRepo && files.length > 0 ? <Counts additions={git!.additions ?? 0} deletions={git!.deletions ?? 0} /> : null}
          <span className="ml-auto" />
          <IconButton label="Refresh" onClick={() => side.refresh()}>
            <RefreshCw className="size-3.5" />
          </IconButton>
        </div>
        {isRepo ? (
          <div className="flex shrink-0 items-center gap-1.5 border-b border-outline px-3 py-1.5 text-[11px] text-ink-muted">
            <GitBranch className="size-3.5 shrink-0" />
            <span className="truncate font-mono">{git!.branch}</span>
            {git!.ahead != null ? (
              <span className={cn("shrink-0 font-mono", git!.ahead > 0 ? "text-success" : "")}>
                {git!.ahead > 0 ? `↑${git!.ahead}` : "0"}
                {git!.behind ? ` ↓${git!.behind}` : ""}
              </span>
            ) : null}
          </div>
        ) : null}
        {files.length > 6 ? (
          <div className="relative shrink-0 border-b border-outline px-2 py-1.5">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-3 -translate-y-1/2 text-ink-muted" />
            <input
              value={filter}
              placeholder="Filter files…"
              className="h-6 w-full rounded bg-surface-muted pl-6 pr-2 text-[11px] outline-none"
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {!git ? (
            <p className="px-3 py-4 text-[12px] text-ink-muted">Loading…</p>
          ) : !isRepo ? (
            <p className="px-3 py-4 text-[12px] text-ink-muted">Not a git repository</p>
          ) : files.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-ink-muted">Working tree clean — no changes.</p>
          ) : visible.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-ink-muted">No files match “{filter}”.</p>
          ) : (
            <FileTree bare title="Changed files" items={items} selectedId={selected ?? undefined} onSelect={setSelected} />
          )}
        </div>
      </div>

      {/* diff */}
      <div className="flex min-w-0 flex-1 flex-col bg-paper">
        <div className="flex shrink-0 items-center gap-2 border-b border-outline px-3 py-1.5">
          <span className="text-[12px] text-ink-muted">{current ? `${KIND[kindOf(current)].label} file` : "Select a file"}</span>
          {loading ? <RefreshCw className="size-3 shrink-0 animate-spin text-ink-muted" /> : null}
          <span className="ml-auto" />
          <IconButton label={wrap ? "Disable word wrap" : "Word wrap"} active={wrap} onClick={() => setWrap((w) => !w)}>
            <WrapText className="size-3.5" />
          </IconButton>
          <div className="flex items-center gap-0.5 rounded-md border border-outline p-0.5">
            <IconButton label="Unified" active={mode === "unified"} onClick={() => setViewMode("unified")}>
              <Rows2 className="size-3.5" />
            </IconButton>
            <IconButton label="Split" active={mode === "split"} onClick={() => setViewMode("split")}>
              <Columns2 className="size-3.5" />
            </IconButton>
          </div>
          <div className="flex items-center gap-0.5">
            <IconButton label="Previous file (k)" onClick={() => go(-1)} disabled={visible.length < 2}>
              <ChevronUp className="size-3.5" />
            </IconButton>
            <span className="min-w-8 text-center font-mono text-[10px] text-ink-muted">{idx >= 0 ? `${idx + 1}/${visible.length}` : "–"}</span>
            <IconButton label="Next file (j)" onClick={() => go(1)} disabled={visible.length < 2}>
              <ChevronDown className="size-3.5" />
            </IconButton>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {!selected || !current ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted">
              <FileDiff_ className="size-8 opacity-40" />
              <p className="text-[12px]">{files.length === 0 && isRepo ? "No changes to show" : "Pick a changed file to see its diff"}</p>
            </div>
          ) : (
            <FileDiff
              key={current.path}
              filename={current.path}
              hunks={loading ? [] : hunks}
              additions={current.additions ?? undefined}
              deletions={current.deletions ?? undefined}
              split={mode === "split"}
              wrap={wrap}
              emptyMessage={loading ? "Loading diff…" : kindOf(current) === "untracked" ? "New untracked file — no diff available." : "No textual diff (binary, empty or unchanged content)."}
            />
          )}
        </div>
      </div>
    </div>
  );
}
