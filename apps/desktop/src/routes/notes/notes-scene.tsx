import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  ListChecks,
  MoreHorizontal,
  NotebookPen,
  PenTool,
  Pencil,
  Plus,
  Sheet,
  Star,
  StickyNote,
  Table,
  Trash2,
  Type,
} from "lucide-react";
import { Tree, adjustMoveIndex, type NodeApi, type NodeRendererProps, type TreeApi } from "react-arborist";
import { useNotesScene, NOTE_GROUP_TYPES, type NoteFolder, type NoteGroupType } from "./use-notes-scene";
import { NotesView } from "./notes-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TYPE_META: Record<NoteGroupType, { label: string; icon: typeof StickyNote }> = {
  notes: { label: "Notes", icon: StickyNote },
  checklist: { label: "Checklist", icon: ListChecks },
  table: { label: "Table", icon: Table },
  sheet: { label: "Sheet", icon: Sheet },
  canvas: { label: "Canvas", icon: PenTool },
};

const ROW_HEIGHT = 28;

interface TreeNodeData {
  id: string;
  name: string;
  kind: "folder" | "group";
  type?: NoteGroupType;
  isFavorite?: boolean;
  children?: TreeNodeData[];
}

type NotesHook = ReturnType<typeof useNotesScene>;

function containsId(node: TreeNodeData, id: string): boolean {
  return (node.children ?? []).some((child) => child.id === id || containsId(child, id));
}

function MenuTrigger(props: React.ComponentProps<"button">) {
  return (
    <button
      {...props}
      className="text-muted-foreground/0 group-hover:text-muted-foreground/70 hover:text-foreground shrink-0 text-xs leading-none"
      title="More"
    >
      <MoreHorizontal size={13} />
    </button>
  );
}

function PlusTrigger(props: React.ComponentProps<"button">) {
  return (
    <button
      {...props}
      className="text-muted-foreground/0 group-hover:text-muted-foreground/70 hover:text-foreground shrink-0 text-xs leading-none"
      title="New…"
    >
      <Plus size={13} />
    </button>
  );
}

function TreeRenameInput({ node }: { node: NodeApi<TreeNodeData> }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      defaultValue={node.data.name}
      className="placeholder:text-muted-foreground h-5 min-w-0 flex-1 rounded-sm border border-input bg-background px-1 text-sm outline-none"
      onClick={(e) => e.stopPropagation()}
      onBlur={() => node.reset()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") node.reset();
        if (e.key === "Enter") node.submit(ref.current?.value ?? "");
      }}
    />
  );
}

function SectionTree({
  nodes,
  notes,
  selectedGroupId,
  scrollRoot,
  onCreate,
}: {
  nodes: TreeNodeData[];
  notes: NotesHook;
  selectedGroupId: string | null;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  onCreate: (parentId: string, parentName: string) => void;
}) {
  const treeRef = useRef<TreeApi<TreeNodeData> | undefined>(undefined);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const nodesById = useMemo(() => {
    const map = new Map<string, TreeNodeData>();
    const walk = (list: TreeNodeData[]) => {
      for (const node of list) {
        map.set(node.id, node);
        walk(node.children ?? []);
      }
    };
    walk(nodes);
    return map;
  }, [nodes]);

  // treeRef is set after the first commit; on that first pass every folder is
  // closed, so only root rows are visible.
  const height = (treeRef.current?.visibleNodes.length ?? nodes.length) * ROW_HEIGHT;
  void tick;

  const handleMove = async ({
    dragNodes,
    dragIds,
    parentId,
    index,
  }: {
    dragNodes: NodeApi<TreeNodeData>[];
    dragIds: string[];
    parentId: string | null;
    index: number;
  }) => {
    const draggedFolder = dragNodes.find((n) => n.data.kind === "folder");
    if (draggedFolder && parentId && containsId(draggedFolder.data, parentId)) return;
    if (dragNodes.some((n) => n.data.kind === "group") && parentId === null) return;

    const siblings = (parentId === null ? nodes : nodesById.get(parentId)?.children) ?? [];
    const to = adjustMoveIndex({ index, dragIds, siblingIds: siblings.map((n) => n.id) });
    const without = siblings.filter((n) => !dragIds.includes(n.id));
    const dragged = siblings.filter((n) => dragIds.includes(n.id));
    const withDragged = [...without];
    withDragged.splice(to, 0, ...dragged);

    for (const node of dragNodes) {
      const oldParent = node.parent?.id ?? null;
      if (oldParent === parentId) continue;
      if (node.data.kind === "folder") {
        await notes.moveFolder.mutateAsync({ id: node.id, parentId });
      } else {
        if (!parentId) return;
        await notes.moveGroup.mutateAsync({ id: node.id, folderId: parentId });
      }
    }

    const folderIds = withDragged.filter((n) => n.kind === "folder").map((n) => n.id);
    const groupIds = withDragged.filter((n) => n.kind === "group").map((n) => n.id);
    if (folderIds.length > 0) notes.reorder.mutate({ kind: "folder", ids: folderIds });
    if (groupIds.length > 0) notes.reorder.mutate({ kind: "group", ids: groupIds });
    bump();
  };

  const handleRename = ({ id, name }: { id: string; name: string }) => {
    const node = nodesById.get(id);
    if (!node) return;
    if (node.kind === "folder") notes.renameFolder.mutate({ id, name });
    else notes.renameGroup.mutate({ id, name });
  };

  const renderNode = ({ node, style, dragHandle, tree }: NodeRendererProps<TreeNodeData>) => {
    const data = node.data;
    const isFolder = data.kind === "folder";
    const Icon = isFolder ? (node.isOpen ? FolderOpen : Folder) : (TYPE_META[data.type ?? "notes"]?.icon ?? TYPE_META.notes.icon);
    const isSelected = !isFolder && selectedGroupId === node.id;

    return (
      <div
        ref={dragHandle}
        style={style}
        className={cn(
          "group flex h-7 cursor-pointer items-center gap-1.5 pr-1.5 text-sm hover:bg-accent",
          isSelected && "bg-accent font-medium",
          node.isDragging && "opacity-50",
          node.willReceiveDrop && "bg-primary/10 ring-1 ring-primary",
        )}
        onClick={() => {
          if (isFolder) node.toggle();
          else notes.setSelectedGroupId(node.id);
        }}
        onDoubleClick={() => tree.edit(node.id)}
      >
        {isFolder ? (
          <ChevronRight size={13} className={cn("text-muted-foreground shrink-0 transition-transform", node.isOpen && "rotate-90")} aria-hidden="true" />
        ) : (
          <span className="w-[13px] shrink-0" />
        )}
        <Icon size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />

        {node.isEditing ? (
          <TreeRenameInput node={node} />
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate">{data.name}</span>

            {!isFolder && (
              <button
                className={cn(
                  "shrink-0 text-xs leading-none",
                  data.isFavorite ? "text-warning" : "text-muted-foreground/0 group-hover:text-muted-foreground/70",
                )}
                title={data.isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={(e) => {
                  e.stopPropagation();
                  notes.toggleFavorite.mutate({ id: node.id, isFavorite: !data.isFavorite });
                }}
              >
                <Star size={12} fill={data.isFavorite ? "currentColor" : "none"} />
              </button>
            )}

            {isFolder && (
              <PlusTrigger
                onClick={(e) => {
                  e.stopPropagation();
                  tree.open(node.id);
                  onCreate(node.id, data.name);
                }}
              />
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <MenuTrigger />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => tree.edit(node.id)}>
                  <Pencil size={13} /> Rename
                </DropdownMenuItem>
                {!isFolder && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Type size={13} /> Change type
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {NOTE_GROUP_TYPES.map((t) => (
                        <DropdownMenuItem key={t} disabled={t === data.type} onSelect={() => notes.setGroupType.mutate({ id: node.id, type: t })}>
                          {(() => {
                            const TIcon = TYPE_META[t].icon;
                            return <TIcon size={13} />;
                          })()}
                          {TYPE_META[t].label}
                          {t === data.type && (
                            <Badge variant="secondary" className="ml-auto text-[10px]">
                              current
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    if (window.confirm(`Delete "${data.name}"${isFolder ? " and everything inside it" : ""}? This cannot be undone.`)) {
                      if (isFolder) notes.deleteFolder.mutate(node.id);
                      else notes.deleteGroup.mutate(node.id);
                    }
                  }}
                >
                  <Trash2 size={13} /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    );
  };

  if (nodes.length === 0) return null;

  return (
    <Tree<TreeNodeData>
      ref={treeRef}
      data={nodes}
      width="100%"
      height={height}
      rowHeight={ROW_HEIGHT}
      indent={14}
      openByDefault={false}
      dndRootElement={scrollRoot.current}
      onMove={handleMove}
      onRename={handleRename}
      onToggle={bump}
      disableMultiSelection
    >
      {renderNode}
    </Tree>
  );
}

function CreatePanel({
  sectionId,
  parentId,
  parentName,
  notes,
  onClose,
}: {
  sectionId: string;
  parentId: string | null;
  parentName: string;
  notes: NotesHook;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<"folder" | NoteGroupType>(parentId ? "notes" : "folder");

  const options: { value: "folder" | NoteGroupType; label: string; icon: typeof Folder }[] = parentId
    ? [{ value: "folder", label: "Folder", icon: Folder }, ...NOTE_GROUP_TYPES.map((t) => ({ value: t, label: TYPE_META[t].label, icon: TYPE_META[t].icon }))]
    : [{ value: "folder", label: "Folder", icon: Folder }];

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (choice === "folder") notes.createFolder.mutate({ sectionId, parentId, name: trimmed });
    else notes.createGroup.mutate({ folderId: parentId!, type: choice, name: trimmed });
    onClose();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 pt-8">
        <div>
          <h2 className="text-base font-semibold">New in “{parentName}”</h2>
          <p className="text-muted-foreground/70 text-xs">Pick a type, name it, create.</p>
        </div>
        <Input
          autoFocus
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="grid grid-cols-3 gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => setChoice(o.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors hover:bg-accent",
                choice === o.value ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              <o.icon size={18} className="text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-medium">{o.label}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}

function FavoriteRow({ group, notes, isSelected }: { group: TreeNodeData; notes: NotesHook; isSelected: boolean }) {
  const Icon = TYPE_META[group.type ?? "notes"]?.icon ?? TYPE_META.notes.icon;
  return (
    <div
      className={cn("group flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-sm hover:bg-accent", isSelected && "bg-accent font-medium")}
      onClick={() => notes.setSelectedGroupId(group.id)}
    >
      <Icon size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{group.name}</span>
      <button
        className="text-warning shrink-0 text-xs leading-none"
        title="Remove from favorites"
        onClick={(e) => {
          e.stopPropagation();
          notes.toggleFavorite.mutate({ id: group.id, isFavorite: false });
        }}
      >
        <Star size={12} fill="currentColor" />
      </button>
    </div>
  );
}

export function NotesScene() {
  const notes = useNotesScene();
  const data = notes.tree.data;

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [sectionRename, setSectionRename] = useState<{ id: string; value: string } | null>(null);
  const [createView, setCreateView] = useState<{ sectionId: string; parentId: string | null; parentName: string } | null>(null);
  const scrollRoot = useRef<HTMLDivElement>(null);

  const foldersById = useMemo(() => new Map((data?.folders ?? []).map((f) => [f.id, f])), [data]);
  const groupsByFolder = useMemo(() => {
    const map = new Map<string, TreeNodeData[]>();
    for (const g of data?.groups ?? []) {
      const bucket = map.get(g.folderId) ?? [];
      bucket.push({ id: g.id, name: g.name, kind: "group", type: g.type, isFavorite: g.isFavorite });
      map.set(g.folderId, bucket);
    }
    return map;
  }, [data]);

  const childFoldersOf = (parentId: string) =>
    (data?.folders ?? []).filter((f) => f.parentId === parentId).sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));

  const folderToNode = (folder: NoteFolder): TreeNodeData => ({
    id: folder.id,
    name: folder.name,
    kind: "folder",
    children: [...(groupsByFolder.get(folder.id) ?? []), ...childFoldersOf(folder.id).map(folderToNode)],
  });

  const sectionNodes = useMemo(() => {
    const map = new Map<string, TreeNodeData[]>();
    for (const section of data?.sections ?? []) {
      map.set(
        section.id,
        (data?.folders ?? [])
          .filter((f) => f.sectionId === section.id && f.parentId === null)
          .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
          .map(folderToNode),
      );
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const selectedGroup = (data?.groups ?? []).find((g) => g.id === notes.selectedGroupId) ?? null;
  const favorites = useMemo(() => {
    const all: TreeNodeData[] = [];
    for (const bucket of groupsByFolder.values()) all.push(...bucket);
    return all.filter((g) => g.isFavorite);
  }, [groupsByFolder]);

  const toggleSection = (id: string) =>
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commitSectionRename = () => {
    if (!sectionRename) return;
    const value = sectionRename.value.trim();
    if (value) notes.renameSection.mutate({ id: sectionRename.id, name: value });
    setSectionRename(null);
  };

  return (
    <div className="flex h-full">
      {/* column 1 — structure */}
      <aside className="bg-card border-r flex h-full w-72 shrink-0 flex-col border-r">
        <div className="border-b flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notes</span>
          <Button
            variant="ghost"
            size="icon-sm"
            title="New section"
            onClick={() => notes.createSection.mutate(undefined)}
            disabled={notes.createSection.isPending}
          >
            <Plus />
          </Button>
        </div>
        <div ref={scrollRoot} className="flex-1 overflow-y-auto py-1">
          {favorites.length > 0 && (
            <div className="mb-2">
              <div className="text-muted-foreground/70 px-3 pb-1 pt-2 text-[11px] font-semibold tracking-wide uppercase">Favorites</div>
              {favorites.map((g) => (
                <FavoriteRow key={g.id} group={g} notes={notes} isSelected={notes.selectedGroupId === g.id} />
              ))}
            </div>
          )}

          {(data?.sections ?? []).map((section) => {
            const isCollapsed = collapsedSections.has(section.id);
            const isRenaming = sectionRename?.id === section.id;
            const hasContent = (sectionNodes.get(section.id) ?? []).length > 0;
            return (
              <div key={section.id} className="mb-1">
                <div className="group flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-1.5 hover:bg-accent" onClick={() => toggleSection(section.id)}>
                  <ChevronRight
                    size={13}
                    className={cn("text-muted-foreground shrink-0 transition-transform", !isCollapsed && "rotate-90", !hasContent && "invisible")}
                    aria-hidden="true"
                  />
                  {isRenaming && sectionRename ? (
                    <Input
                      autoFocus
                      className="h-6 px-1 text-sm"
                      value={sectionRename.value}
                      onChange={(e) => setSectionRename({ id: section.id, value: e.target.value })}
                      onBlur={commitSectionRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitSectionRename();
                        if (e.key === "Escape") setSectionRename(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{section.name}</span>
                  )}
                  <PlusTrigger
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateView({ sectionId: section.id, parentId: null, parentName: section.name });
                    }}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <MenuTrigger />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={() => setSectionRename({ id: section.id, value: section.name })}>
                        <Pencil size={13} /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          if (window.confirm(`Delete section "${section.name}" and everything inside it? This cannot be undone.`))
                            notes.deleteSection.mutate(section.id);
                        }}
                      >
                        <Trash2 size={13} /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {!isCollapsed && (
                  <SectionTree
                    nodes={sectionNodes.get(section.id) ?? []}
                    notes={notes}
                    selectedGroupId={notes.selectedGroupId}
                    scrollRoot={scrollRoot}
                    onCreate={(parentId, parentName) => setCreateView({ sectionId: section.id, parentId, parentName })}
                  />
                )}
              </div>
            );
          })}

          {notes.tree.isSuccess && (data?.sections ?? []).length === 0 && (
            <p className="text-muted-foreground p-3 text-sm">
              No sections yet — hit <span className="font-semibold">+</span> to create your first one.
            </p>
          )}
          {notes.tree.isPending && <p className="text-muted-foreground p-3 text-sm">Loading…</p>}
        </div>
      </aside>

      {/* column 2 — create view / note-group content (placeholder) */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {createView ? (
          <CreatePanel
            sectionId={createView.sectionId}
            parentId={createView.parentId}
            parentName={createView.parentName}
            notes={notes}
            onClose={() => setCreateView(null)}
          />
        ) : selectedGroup ? (
          <>
            <div className="border-b flex items-center gap-2 border-b px-4 py-2.5">
              <span className="text-sm font-semibold">{selectedGroup.name}</span>
              <Badge variant="secondary">{TYPE_META[selectedGroup.type].label}</Badge>
              <button
                className={cn("ml-1 text-xs leading-none", selectedGroup.isFavorite ? "text-warning" : "text-muted-foreground/70 hover:text-foreground")}
                title={selectedGroup.isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={() => notes.toggleFavorite.mutate({ id: selectedGroup.id, isFavorite: !selectedGroup.isFavorite })}
              >
                <Star size={13} fill={selectedGroup.isFavorite ? "currentColor" : "none"} />
              </button>
              <span className="text-muted-foreground/60 ml-auto truncate text-xs">{folderPath(foldersById, selectedGroup.folderId)}</span>
            </div>
            <NotesView key={selectedGroup.id} groupId={selectedGroup.id} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <NotebookPen size={28} className="text-muted-foreground/50" aria-hidden="true" />
              <p className="text-muted-foreground text-sm font-medium">Notes</p>
              <p className="text-muted-foreground/70 max-w-xs text-center text-xs">
                Pick a note-group from a folder to open it. Star groups you use often — they pin to the top.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function folderPath(foldersById: Map<string, NoteFolder>, folderId: string) {
  const parts: string[] = [];
  let current: string | null = folderId;
  while (current) {
    const folder = foldersById.get(current);
    if (!folder) break;
    parts.unshift(folder.name);
    current = folder.parentId;
  }
  return parts.join(" / ");
}
