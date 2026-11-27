import type { FileTreeItem } from "../../components/ui/file-tree.js";
import type { GitInfo } from "./hooks/useSessionSide.js";

export type GitFile = NonNullable<GitInfo["files"]>[number];
export type Kind = "modified" | "added" | "deleted" | "renamed" | "untracked";

export const KIND_LABEL: Record<Kind, string> = { modified: "Modified", added: "Added", deleted: "Deleted", renamed: "Renamed", untracked: "Untracked" };
const BY_LETTER: Record<string, Kind> = { M: "modified", A: "added", D: "deleted", R: "renamed", C: "added", "?": "untracked", U: "untracked" };
export const kindOf = (f: GitFile): Kind => BY_LETTER[f.status.slice(0, 1)] ?? "modified";

interface Dir {
  name: string;
  dirs: Map<string, Dir>;
  files: GitFile[];
}

/** Nested folder tree from flat paths; single-child folder chains are compacted ("src/routes/chat"). */
export function buildItems(files: GitFile[]): FileTreeItem[] {
  const root: Dir = { name: "", dirs: new Map(), files: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let d = root;
    for (const part of parts.slice(0, -1)) {
      let next = d.dirs.get(part);
      if (!next) d.dirs.set(part, (next = { name: part, dirs: new Map(), files: [] }));
      d = next;
    }
    d.files.push(f);
  }
  const out: FileTreeItem[] = [];
  const emit = (d: Dir, prefix: string, depth: number) => {
    for (const dir of [...d.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      let cur = dir;
      let name = dir.name;
      while (cur.files.length === 0 && cur.dirs.size === 1) {
        cur = [...cur.dirs.values()][0];
        name += `/${cur.name}`;
      }
      const path = prefix ? `${prefix}/${name}` : name;
      out.push({ id: `dir:${path}`, name, kind: "folder", depth, expanded: true, title: path });
      emit(cur, path, depth + 1);
    }
    for (const f of [...d.files].sort((a, b) => a.path.localeCompare(b.path))) {
      const k = kindOf(f);
      out.push({
        id: f.path,
        name: f.path.split("/").pop() ?? f.path,
        kind: "file",
        depth,
        title: `${f.path} — ${KIND_LABEL[k]}`,
        status: k === "added" || k === "untracked" ? "added" : k === "deleted" ? "deleted" : "modified",
        additions: f.additions,
        deletions: f.deletions,
      });
    }
  };
  emit(root, "", 0);
  return out;
}

