import { useMemo, useState } from "react";
import { ChevronDown, FileDiff, FileMinus, FilePen, FilePlus, FileQuestion, Folder, GitBranch, RefreshCw, type LucideIcon } from "lucide-react";
import { cn } from "../../../lib/cn.js";
import type { GitInfo } from "../hooks/useSessionSide.js";

type FileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked";

const FILE_STATUS: Record<FileStatus, { icon: LucideIcon; tone: string }> = {
  modified: { icon: FilePen, tone: "text-warning" },
  added: { icon: FilePlus, tone: "text-success" },
  deleted: { icon: FileMinus, tone: "text-destructive" },
  renamed: { icon: FileDiff, tone: "text-info" },
  untracked: { icon: FileQuestion, tone: "text-ink-muted" },
};

const BY_LETTER: Record<string, FileStatus> = { M: "modified", A: "added", D: "deleted", R: "renamed", C: "added", "?": "untracked", U: "untracked" };

type GitFile = NonNullable<GitInfo["files"]>[number];
interface Group {
  folder: string;
  files: Array<GitFile & { name: string; kind: FileStatus }>;
  additions: number;
  deletions: number;
}

function group(files: GitFile[]): Group[] {
  const map = new Map<string, Group>();
  for (const f of files) {
    const slash = f.path.lastIndexOf("/");
    const folder = slash === -1 ? "" : f.path.slice(0, slash);
    const g = map.get(folder) ?? { folder, files: [], additions: 0, deletions: 0 };
    g.files.push({ ...f, name: slash === -1 ? f.path : f.path.slice(slash + 1), kind: BY_LETTER[f.status.slice(0, 1)] ?? "modified" });
    g.additions += f.additions ?? 0;
    g.deletions += f.deletions ?? 0;
    map.set(folder, g);
  }
  return [...map.values()];
}

function Counts(props: { additions: number | null; deletions: number | null; className?: string }) {
  return (
    <span className={cn("flex shrink-0 gap-2 font-mono text-xs font-normal tabular-nums", props.className)}>
      {props.additions !== null ? <span className="text-success">+{props.additions}</span> : null}
      {props.deletions !== null ? <span className="text-destructive">−{props.deletions}</span> : null}
    </span>
  );
}

function FileRow(props: { file: Group["files"][number]; nested: boolean }) {
  const { icon: Icon, tone } = FILE_STATUS[props.file.kind];
  return (
    <div className={cn("flex min-h-7 items-center gap-2 pr-3 text-xs", props.nested ? "pl-9" : "pl-3")}>
      <Icon size={14} className={cn("shrink-0", tone)} aria-label={props.file.kind} />
      <span className="min-w-0 flex-1 truncate font-mono text-ink/85" title={`${props.file.path} — ${props.file.kind}`}>
        {props.file.name}
      </span>
      <Counts additions={props.file.additions} deletions={props.file.deletions} />
    </div>
  );
}

function FolderRow(props: { g: Group }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-h-7 w-full items-center gap-2 px-3 text-left text-xs hover:bg-surface-muted/50">
        <ChevronDown size={14} className={cn("shrink-0 text-ink-muted transition-transform", !open && "-rotate-90")} />
        <Folder size={14} className="shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1 truncate font-mono" title={props.g.folder}>{props.g.folder}</span>
        <Counts additions={props.g.additions} deletions={props.g.deletions} />
      </button>
      {open ? props.g.files.map((f) => <FileRow key={f.path} file={f} nested />) : null}
    </div>
  );
}

/** Legacy "Git Summary": branch + ahead/behind, changed files grouped by folder with line counts. */
export function GitSection(props: { git: GitInfo | null; refreshing: boolean; onRefresh: () => void }) {
  const { git } = props;
  const [open, setOpen] = useState(true);
  const files = git?.files ?? [];
  const groups = useMemo(() => group(files), [files]);
  const isRepo = !!git && git.git !== false;
  const showTotals = isRepo && files.length > 0;
  const title = showTotals ? `${files.length} changed ${files.length === 1 ? "file" : "files"}` : "Git Summary";

  return (
    <div data-slot="git-section" className="border-b last:border-b-0">
      <div className="flex items-center">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left text-sm font-medium hover:bg-surface-muted/50">
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
              {groups.map((g) => (g.folder ? <FolderRow key={g.folder} g={g} /> : g.files.map((f) => <FileRow key={f.path} file={f} nested={false} />)))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
