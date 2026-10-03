import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  ListChecks,
  MoreHorizontal,
  PenTool,
  Pencil,
  Plus,
  Sheet,
  StickyNote,
  Star,
  Table,
  Trash2,
  Type,
} from "lucide-react";
import { Tree, adjustMoveIndex, type NodeApi, type NodeRendererProps, type TreeApi } from "react-arborist";
import { NOTE_GROUP_TYPES, type NoteGroupType } from "../use-notes-scene";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const TYPE_META: Record<NoteGroupType, { label: string; icon: typeof StickyNote }> = {
  notes: { label: "Notes", icon: StickyNote },
  checklist: { label: "Checklist", icon: ListChecks },
  table: { label: "Table", icon: Table },
  sheet: { label: "Sheet", icon: Sheet },
  canvas: { label: "Canvas", icon: PenTool },
};

export const ROW_HEIGHT = 28;

export interface TreeNodeData {
  id: string;
  name: string;
  kind: "folder" | "group";
  type?: NoteGroupType;
  isFavorite?: boolean;
  children?: TreeNodeData[];
}

export type NotesHook = ReturnType<typeof import("../use-notes-scene").useNotesScene>;

function containsId(node: TreeNodeData, id: string): boolean {
  return (node.children ?? []).some((child) => child.id === id || containsId(child, id));
}

export function MenuTrigger(props: React.ComponentProps<"button">) {
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

export function PlusTrigger(props: React.ComponentProps<"button">) {
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

export function SectionTree({
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
