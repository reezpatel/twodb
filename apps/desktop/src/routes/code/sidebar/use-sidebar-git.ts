import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CodeCommitFileStatus } from "@/components/blocks/code/code-sidebar/code-commit";
import { useSessionDirectory } from "../chat/use-session-directory";
import { useGitStatus } from "../directories/use-git-status";

interface GitChangeFile {
  path: string;
  status: string;
  additions: number | null;
  deletions: number | null;
}

export interface SidebarGitFile {
  path: string;
  name: string;
  status: CodeCommitFileStatus;
  additions: number | null;
  deletions: number | null;
}

export interface SidebarGitGroup {
  /** Directory the files sit in; "" for files at the repo root. */
  folder: string;
  files: SidebarGitFile[];
  additions: number;
  deletions: number;
}

const STATUS_BY_LETTER: Record<string, CodeCommitFileStatus> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "added",
  U: "untracked",
};

function sumLines(files: SidebarGitFile[], key: "additions" | "deletions") {
  return files.reduce((total, file) => total + (file[key] ?? 0), 0);
}

function groupByFolder(files: GitChangeFile[]): SidebarGitGroup[] {
  const byFolder = new Map<string, SidebarGitFile[]>();
  for (const file of files) {
    const slash = file.path.lastIndexOf("/");
    const folder = slash === -1 ? "" : file.path.slice(0, slash);
    const row: SidebarGitFile = {
      path: file.path,
      name: slash === -1 ? file.path : file.path.slice(slash + 1),
      status: STATUS_BY_LETTER[file.status] ?? "modified",
      additions: file.additions,
      deletions: file.deletions,
    };
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), row]);
  }
  return [...byFolder].map(([folder, rows]) => ({
    folder,
    files: rows,
    additions: sumLines(rows, "additions"),
    deletions: sumLines(rows, "deletions"),
  }));
}

/**
 * Real git summary for the selected session's directory: branch line from
 * git-status, changed files from git-changes (grouped by folder). Both are
 * invalidated by the chat panel after a run (the footer gitStatus frame
 * already does this).
 */
export function useSidebarGit() {
  const queryClient = useQueryClient();
  const { directoryId } = useSessionDirectory();
  const status = useGitStatus(directoryId);
  const changes = useQuery({
    queryKey: ["code", "directories", directoryId, "changes"],
    queryFn: () => api<{ git: boolean; files: GitChangeFile[] }>(`/api/code/directories/${directoryId}/git-changes`),
    enabled: !!directoryId && status.data?.git === true,
    retry: false,
  });
  const isNoGit = (status.data && status.data.git === false) || (changes.data && changes.data.git === false);
  const rawFiles = changes.data?.git === true ? changes.data.files : null;

  const summary = useMemo(() => {
    const groups = groupByFolder(rawFiles ?? []);
    return {
      groups,
      fileCount: rawFiles?.length ?? 0,
      additions: groups.reduce((total, g) => total + g.additions, 0),
      deletions: groups.reduce((total, g) => total + g.deletions, 0),
    };
  }, [rawFiles]);

  return {
    hasDirectory: !!directoryId,
    isPending: status.isPending || (status.data?.git === true && changes.isPending),
    isError: status.isError || changes.isError,
    isRefetching: status.isFetching || changes.isFetching,
    errorText: status.isError ? (status.error instanceof Error ? status.error.message : "failed to load") : "failed to load changes",
    isNoGit,
    branch: status.data?.branch ?? "—",
    ahead: status.data?.ahead ?? null,
    behind: status.data?.behind ?? null,
    ...summary,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["code", "directories", directoryId, "git"] });
      void queryClient.invalidateQueries({ queryKey: ["code", "directories", directoryId, "changes"] });
    },
  };
}
