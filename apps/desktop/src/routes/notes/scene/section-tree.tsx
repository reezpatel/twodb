import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Database, FileText, MoreHorizontal, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Tree, adjustMoveIndex, type NodeApi, type NodeRendererProps, type TreeApi } from "react-arborist";
import { assetPreviewUrl, type NoteKind, type NotesHook } from "../use-notes-scene";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const ROW_HEIGHT = 26;

/** Sidebar row: pages carry children (pages + databases); databases are
 *  leaves (their rows live in the database views). */
export interface TreeItem {
  id: string;
  title: string;
  kind: Exclude<NoteKind, "section">;
  icon: string | null;
  isFavorite: boolean;
  children?: TreeItem[];
}

export function NodeIcon({ kind, icon, size = 14 }: { kind: NoteKind; icon: string | null; size?: number }) {
  const url = assetPreviewUrl(icon);
  if (url) return <img src={url} alt="" className="shrink-0 rounded-sm object-contain" style={{ width: size, height: size }} />;
  const Icon = kind === "database" ? Database : FileText;
  return <Icon size={size} className="text-muted-foreground/70 shrink-0" aria-hidden="true" />;
}

export function MenuTrigger(props: React.ComponentProps<"button">) {
  return (
    <button {...props} className="text-muted-foreground/0 group-hover:text-muted-foreground/70 hover:text-foreground shrink-0 text-xs leading-none" title="More">
      <MoreHorizontal size={13} />
    </button>
  );
}

export function PlusTrigger({ title = "Add a page inside", ...props }: React.ComponentProps<"button">) {
  return (
    <button {...props} className="text-muted-foreground/0 group-hover:text-muted-foreground/70 hover:text-foreground shrink-0 text-xs leading-none" title={title}>
      <Plus size={13} />
    </button>
  );
}

function TreeRenameInput({ node }: { node: NodeApi<TreeItem> }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      defaultValue={node.data.title}
      className="h-5 min-w-0 flex-1 rounded-sm border border-input bg-background px-1 text-sm outline-none"
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

/** One section's page/database tree (react-arborist; drag to move/reorder). */
export function SectionTree({
  sectionId,
  nodes,
  notes,
  scrollRoot,
}: {
  sectionId: string;
  nodes: TreeItem[];
  notes: NotesHook;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
}) {
  const treeRef = useRef<TreeApi<TreeItem> | undefined>(undefined);

  const byId = useMemo(() => {
    const map = new Map<string, TreeItem>();
    const walk = (list: TreeItem[]) => list.forEach((n) => (map.set(n.id, n), walk(n.children ?? [])));
    walk(nodes);
    return map;
  }, [nodes]);

  // Open state mirrored from the tree so the container height is computed in
  // the same render as the visible rows (no inner scrollbar flash).
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const height = useMemo(() => {
    const count = (list: TreeItem[]): number => list.reduce((n, item) => n + 1 + (openIds.has(item.id) ? count(item.children ?? []) : 0), 0);
    return count(nodes) * ROW_HEIGHT;
  }, [nodes, openIds]);

  const handleToggle = (id: string) => {
    const isOpen = treeRef.current?.isOpen(id) ?? false;
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleMove = async ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
    const targetParent = parentId ?? sectionId;
    const siblings = (parentId === null ? nodes : byId.get(parentId)?.children) ?? [];
    const to = adjustMoveIndex({ index, dragIds, siblingIds: siblings.map((n) => n.id) });
    const ordered = siblings.filter((n) => !dragIds.includes(n.id)).map((n) => n.id);
    ordered.splice(to, 0, ...dragIds);

    for (const id of dragIds) {
      const currentParent = treeRef.current?.get(id)?.parent?.id ?? null;
      if ((currentParent ?? null) !== parentId) await notes.updateNode.mutateAsync({ id, parentId: targetParent });
    }
    notes.reorder.mutate(ordered);
  };

  const renderNode = ({ node, style, dragHandle, tree }: NodeRendererProps<TreeItem>) => {
    const data = node.data;
    const hasChildren = (data.children?.length ?? 0) > 0;
    const isSelected = notes.selectedId === node.id;

    return (
      <div
        ref={dragHandle}
        style={style}
        className={cn(
          "group flex h-[26px] cursor-pointer items-center gap-1 pr-1 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground",
          isSelected && "bg-accent font-medium text-foreground",
          node.isDragging && "opacity-50",
          node.willReceiveDrop && "bg-primary/10 ring-1 ring-primary",
        )}
        onClick={() => notes.select(node.id)}
        onDoubleClick={() => tree.edit(node.id)}
      >
        <button
          className={cn("text-muted-foreground/60 hover:text-foreground flex w-3 shrink-0 justify-center", !hasChildren && "invisible")}
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
          tabIndex={-1}
          aria-label={node.isOpen ? "Collapse" : "Expand"}
        >
          <ChevronRight size={12} className={cn("transition-transform", node.isOpen && "rotate-90")} aria-hidden="true" />
        </button>
        <NodeIcon kind={data.kind} icon={data.icon} />

        {node.isEditing ? (
          <TreeRenameInput node={node} />
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate">{data.title || "Untitled"}</span>
            {data.kind === "page" && (
              <PlusTrigger
                onClick={(e) => {
                  e.stopPropagation();
                  tree.open(node.id);
                  notes.createNode.mutate({ parentId: node.id });
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
                <DropdownMenuItem onSelect={() => notes.toggleFavorite.mutate({ id: node.id, isFavorite: !data.isFavorite })}>
                  <Star size={13} /> {data.isFavorite ? "Remove from favorites" : "Add to favorites"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    const what = data.kind === "database" ? "database (it can be restored from All databases)" : "page and its sub-pages";
                    if (window.confirm(`Delete "${data.title || "Untitled"}"? This moves the ${what} to trash.`)) notes.deleteNode.mutate(node.id);
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
    <Tree<TreeItem>
      ref={treeRef}
      data={nodes}
      width="100%"
      height={height}
      rowHeight={ROW_HEIGHT}
      indent={12}
      openByDefault={false}
      dndRootElement={scrollRoot.current}
      // databases hold rows, not sidebar children
      disableDrop={({ parentNode }) => parentNode?.data?.kind === "database"}
      onMove={handleMove}
      onRename={({ id, name }) => notes.updateNode.mutate({ id, title: name })}
      onToggle={handleToggle}
      disableMultiSelection
    >
      {renderNode}
    </Tree>
  );
}
