import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, GitCommitHorizontal, Loader2 } from "lucide-react";
import { useSessionDirectory } from "../use-session-directory";
import { useGitStatus } from "../../directories/use-git-status";
import { GitInitCard } from "./git-init-card";
import { DiffView } from "./diff-view";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChangeFile {
  path: string;
  oldPath: string | null;
  status: string;
  additions: number | null;
  deletions: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  U: "text-muted-foreground",
  A: "text-success",
  D: "text-destructive",
};

function b64path(path: string) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(path)));
}

export function ChangesScreen() {
  const { directory, directoryId, isPending } = useSessionDirectory();
  const git = useGitStatus(directoryId);
  const [expanded, setExpanded] = useState<string | null>(null);

  const changes = useQuery({
    queryKey: ["code", "directories", directoryId, "changes"],
    queryFn: () => api<{ git: boolean; files: ChangeFile[] }>(`/api/code/directories/${directoryId}/git-changes`),
    enabled: !!directoryId && git.data?.git === true,
  });

  // Patch text is fetched only for the expanded file and cached per path —
  // the list itself stays O(changed files) with no diff bytes.
  const diff = useQuery({
    queryKey: ["code", "directories", directoryId, "diff", expanded],
    queryFn: () => api<{ path: string; diff: string }>(`/api/code/directories/${directoryId}/git-diff?path=${b64path(expanded!)}`),
    enabled: !!expanded,
  });

  if (isPending) return null;

  if (!directoryId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <GitCommitHorizontal size={28} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-muted-foreground text-sm font-medium">No directory assigned</p>
        <p className="text-muted-foreground/70 max-w-xs text-center text-xs">
          Sessions get their directory at creation — start one with the + next to a directory in the sidebar.
        </p>
      </div>
    );
  }

  if (git.isError) {
    const message = (git.error as Error).message;
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive text-sm">
          {message === "runner_offline"
            ? "Runner is offline — start it and try again."
            : message === "directory_missing"
              ? "This directory no longer exists on the runner."
              : "Could not read git status."}
        </p>
      </div>
    );
  }

  if (!git.data) return null;
  if (!git.data.git) return <GitInitCard directoryId={directoryId} cwd={directory?.cwd ?? ""} />;

  const files = changes.data?.files ?? [];

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-3 overflow-y-auto p-4">
      <div>
        <p className="text-sm font-medium">Changes</p>
        <p className="text-muted-foreground truncate text-xs">
          <span className="font-mono">{git.data.branch ?? "detached"}</span> · {files.length} files
          {git.data.ahead !== null ? (
            <>
              {" "}
              · ↑{git.data.ahead} ↓{git.data.behind}
            </>
          ) : null}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        {changes.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 px-3 py-3 text-sm">
            <Loader2 size={14} className="animate-spin" /> loading…
          </div>
        ) : files.length === 0 ? (
          <div className="text-muted-foreground px-3 py-6 text-center text-sm">Working tree clean</div>
        ) : (
          files.map((file) => (
            <div key={file.path} className="border-b last:border-b-0">
              <button
                className="hover:bg-accent/50 flex w-full items-center gap-2 px-3 py-1.5 text-left"
                onClick={() => setExpanded(expanded === file.path ? null : file.path)}
              >
                <ChevronRight
                  size={13}
                  className={cn("text-muted-foreground shrink-0 transition-transform", expanded === file.path && "rotate-90")}
                  aria-hidden="true"
                />
                <span className={cn("w-4 shrink-0 text-center font-mono text-xs font-semibold", STATUS_COLORS[file.status] ?? "text-foreground")}>
                  {file.status}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={file.path}>
                  {file.oldPath ? <span className="text-muted-foreground">{file.oldPath} → </span> : null}
                  {file.path}
                </span>
                <span className="shrink-0 font-mono text-[11px]">
                  {file.additions !== null ? <span className="text-success">+{file.additions}</span> : <span className="text-muted-foreground">+?</span>}{" "}
                  {file.deletions !== null ? <span className="text-destructive">−{file.deletions}</span> : <span className="text-muted-foreground">−?</span>}
                </span>
              </button>
              {expanded === file.path && (
                <div className="max-h-96 overflow-auto border-t">
                  {diff.isPending ? (
                    <div className="text-muted-foreground flex items-center gap-2 px-3 py-3 text-xs">
                      <Loader2 size={12} className="animate-spin" /> loading diff…
                    </div>
                  ) : diff.isError ? (
                    <div className="text-destructive px-3 py-2 text-xs">{(diff.error as Error).message}</div>
                  ) : (diff.data?.diff ?? "") === "" ? (
                    <div className="text-muted-foreground px-3 py-2 text-xs">No textual diff (binary or unchanged).</div>
                  ) : (
                    <DiffView text={diff.data!.diff} />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-muted-foreground/70 text-[11px]">Uncommitted work-tree changes vs HEAD — untracked files included, gitignored files excluded.</p>
    </div>
  );
}
