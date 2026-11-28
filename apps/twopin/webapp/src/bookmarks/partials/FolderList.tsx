import { Button, Input } from "@twodb/blocks";
import { Folder, FolderOpen, FolderPlus, Inbox, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { BookmarkFolderDto } from "../../lib/twopin-client.js";
import type { BookmarkSelection } from "../hooks/useBookmarks.js";

interface FolderListProps {
  folders: BookmarkFolderDto[];
  loading: boolean;
  selection: BookmarkSelection;
  totalCount: number;
  onSelect: (sel: BookmarkSelection) => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<unknown>;
  onRenameFolder: (id: string, name: string) => Promise<unknown>;
  onDeleteFolder: (id: string) => Promise<unknown>;
}

interface FolderNode {
  folder: BookmarkFolderDto;
  depth: number;
}

/** Flattens the folder tree (parentId links) into display order, tracking depth for indentation. */
function buildTree(folders: BookmarkFolderDto[]): FolderNode[] {
  const byParent = new Map<string | null, BookmarkFolderDto[]>();
  for (const f of folders) {
    // Orphans (parent not in the list) render at the root.
    const key = f.parentId && folders.some((p) => p.id === f.parentId) ? f.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), f]);
  }
  const out: FolderNode[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const f of byParent.get(parentId) ?? []) {
      out.push({ folder: f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** In-page folder rail for Bookmarks: All / Unfiled / an indented folder tree. */
export function FolderList(props: FolderListProps) {
  const [adding, setAdding] = useState(false);
  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await props.onCreateFolder(trimmed, addingParentId);
      setName("");
      setAdding(false);
      setAddingParentId(null);
    } finally {
      setBusy(false);
    }
  };

  const startAdding = (parentId: string | null) => {
    setName("");
    setAddingParentId(parentId);
    setAdding(true);
  };

  const row = (active: boolean) =>
    `group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
      active ? "bg-stone font-semibold text-ink" : "text-ink-muted hover:bg-stone/60 hover:text-ink"
    }`;

  const nodes = buildTree(props.folders);

  const addForm = (
    <form
      className="mb-2 flex gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={addingParentId ? "Subfolder name" : "Folder name"}
        disabled={busy}
        onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
      />
      <Button type="submit" size="sm" disabled={!name.trim() || busy}>
        Add
      </Button>
    </form>
  );

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-outline p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Folders</span>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => (adding && !addingParentId ? setAdding(false) : startAdding(null))} aria-label="New folder">
          <Plus className="size-3.5" />
        </Button>
      </div>

      {adding && !addingParentId && addForm}

      <button className={row(props.selection === "all")} onClick={() => props.onSelect("all")}>
        <Layers className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">All</span>
        <span className="text-xs text-ink-muted">{props.totalCount}</span>
      </button>
      <button className={row(props.selection === "unfiled")} onClick={() => props.onSelect("unfiled")}>
        <Inbox className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Unfiled</span>
      </button>

      {nodes.map(({ folder, depth }) => (
        <div key={folder.id}>
          <FolderRow
            folder={folder}
            depth={depth}
            active={props.selection === folder.id}
            rowClass={row}
            onSelect={() => props.onSelect(folder.id)}
            onRename={props.onRenameFolder}
            onDelete={props.onDeleteFolder}
            onAddSubfolder={() => startAdding(folder.id)}
          />
          {adding && addingParentId === folder.id && <div style={{ paddingLeft: (depth + 1) * 16 }}>{addForm}</div>}
        </div>
      ))}

      {!props.loading && props.folders.length === 0 && <p className="px-3 py-2 text-sm text-ink-muted">No folders yet.</p>}
    </aside>
  );
}

function FolderRow({
  folder,
  depth,
  active,
  rowClass,
  onSelect,
  onRename,
  onDelete,
  onAddSubfolder,
}: {
  folder: BookmarkFolderDto;
  depth: number;
  active: boolean;
  rowClass: (active: boolean) => string;
  onSelect: () => void;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onAddSubfolder: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const Icon = active ? FolderOpen : Folder;

  if (editing) {
    return (
      <form
        className="flex gap-1 px-1"
        style={{ paddingLeft: depth * 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed && trimmed !== folder.name) void onRename(folder.id, trimmed);
          setEditing(false);
        }}
      >
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditing(false)} />
      </form>
    );
  }

  return (
    <button className={rowClass(active)} style={{ paddingLeft: 12 + depth * 16 }} onClick={onSelect} onDoubleClick={() => setEditing(true)}>
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{folder.name}</span>
      <span className="text-xs text-ink-muted group-hover:hidden">{folder.bookmarkCount}</span>
      <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        <span
          role="button"
          aria-label={`New subfolder in ${folder.name}`}
          className="text-ink-muted hover:text-ink"
          onClick={(e) => {
            e.stopPropagation();
            onAddSubfolder();
          }}
        >
          <FolderPlus className="size-3.5" />
        </span>
        <span
          role="button"
          aria-label={`Rename ${folder.name}`}
          className="text-ink-muted hover:text-ink"
          onClick={(e) => {
            e.stopPropagation();
            setName(folder.name);
            setEditing(true);
          }}
        >
          <Pencil className="size-3.5" />
        </span>
        <span
          role="button"
          aria-label={`Delete ${folder.name}`}
          className="text-ink-muted hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Delete folder "${folder.name}" and its ${folder.bookmarkCount} bookmarks?`)) void onDelete(folder.id);
          }}
        >
          <Trash2 className="size-3.5" />
        </span>
      </span>
    </button>
  );
}

