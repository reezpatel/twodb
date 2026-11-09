import { useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { File, FolderClosed, FolderOpen, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Tree, adjustMoveIndex, type NodeApi, type NodeRendererProps, type TreeApi } from "react-arborist";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAppNav, type AppNavIcon } from "./app-nav-context";
import { AppNavSection } from "./app-nav-section";

/** A file or folder. A node with a `children` array (even empty) is a folder. */
export interface AppNavFileNode {
  id: string;
  name: string;
  /** Overrides the default file / folder icon. */
  icon?: AppNavIcon;
  /** Small pill at the end of the row, e.g. "3" or "new". */
  badge?: string;
  children?: AppNavFileNode[];
  /** Folders only: start expanded. */
  defaultOpen?: boolean;
}

export interface AppNavFileMove {
  /** Everything that was dragged. */
  ids: string[];
  /** New parent, or null for the section root. */
  parentId: string | null;
  /** Insert position among the new parent's children AFTER the dragged ones are removed from them. */
  index: number;
}

export interface AppNavFileTreeProps extends Omit<ComponentProps<"div">, "title" | "onSelect"> {
  title: string;
  nodes: AppNavFileNode[];
  defaultExpanded?: boolean;
  /** Tallest the tree grows before it scrolls. Only visible rows are rendered, so very long trees stay cheap. Default 320. */
  maxHeight?: number;
  /** Drag-and-drop move / reorder. Omit to make the tree read-only for drags. */
  onMove?: (move: AppNavFileMove) => void;
  /** Inline rename (double-click or menu). Omit to disable renaming. */
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
  /** "+" in the header (parentId null) and on folder rows. Omit to hide the buttons. */
  onCreate?: (parentId: string | null) => void;
  /** Extra header actions next to "+". */
  actions?: ReactNode;
  /** Shown when `nodes` is empty. */
  emptyLabel?: string;
}

const ROW_HEIGHT = 28;
const INDENT = 14;

function collectOpen(nodes: AppNavFileNode[], into: Record<string, boolean> = {}) {
  for (const node of nodes) {
    if (node.children) {
      if (node.defaultOpen) into[node.id] = true;
      collectOpen(node.children, into);
    }
  }
  return into;
}

function visibleCount(nodes: AppNavFileNode[], open: Record<string, boolean>): number {
  return nodes.reduce((total, node) => total + 1 + (node.children && open[node.id] ? visibleCount(node.children, open) : 0), 0);
}

function RowAction({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-foreground/8 focus-visible:ring-ring flex size-5 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-1",
        className,
      )}
    />
  );
}

function RenameInput({ node }: { node: NodeApi<AppNavFileNode> }) {
  return (
    <input
      autoFocus
      defaultValue={node.data.name}
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => node.reset()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") node.reset();
        if (e.key === "Enter") node.submit(e.currentTarget.value);
      }}
      className="border-input bg-background h-5 min-w-0 flex-1 rounded-sm border px-1 font-mono text-xs outline-none"
    />
  );
}

/**
 * Section type #2: a draggable, renameable file tree. Rows are virtualized, so a
 * section can hold thousands of nodes and scrolls inside `maxHeight`. Several
 * can sit in one <AppNav>; selection is shared with the links sections.
 */
export function AppNavFileTree({
  title,
  nodes,
  defaultExpanded,
  maxHeight = 320,
  onMove,
  onRename,
  onDelete,
  onCreate,
  actions,
  emptyLabel = "Nothing here yet",
  className,
  ...props
}: AppNavFileTreeProps) {
  const { selectedId, onSelect } = useAppNav();
  const treeRef = useRef<TreeApi<AppNavFileNode> | undefined>(undefined);
  const initialOpen = useMemo(() => collectOpen(nodes), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Open state mirrored from the tree so the container height is right in the same render as the rows.
  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  const height = Math.min(visibleCount(nodes, open) * ROW_HEIGHT, maxHeight);

  const handleToggle = (id: string) => {
    const isOpen = treeRef.current?.isOpen(id) ?? false;
    setOpen((cur) => ({ ...cur, [id]: isOpen }));
  };

  const header = (
    <>
      {actions}
      {onCreate ? (
        <RowAction title="New" aria-label={`New in ${title}`} onClick={() => onCreate(null)}>
          <Plus className="size-3.5" />
        </RowAction>
      ) : null}
    </>
  );

  const renderNode = ({ node, style, dragHandle, tree }: NodeRendererProps<AppNavFileNode>) => {
    const data = node.data;
    const folder = node.isInternal;
    const selected = !folder && selectedId === node.id;
    const Icon = data.icon ?? (folder ? (node.isOpen ? FolderOpen : FolderClosed) : File);

    return (
      <div
        ref={dragHandle}
        style={style}
        role="treeitem"
        aria-selected={selected}
        aria-expanded={folder ? node.isOpen : undefined}
        className={cn(
          "group text-muted-foreground hover:bg-accent/60 hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-none pr-1.5 py-1 text-sm outline-none",
          selected && "bg-secondary text-foreground font-medium",
          node.isFocused && "bg-accent/70",
          node.isDragging && "opacity-50",
          node.willReceiveDrop && "bg-primary/10 ring-primary ring-1",
        )}
        onClick={() => (folder ? node.toggle() : onSelect(node.id))}
        onDoubleClick={() => onRename && tree.edit(node.id)}
      >
        <span className="text-muted-foreground/60 flex w-3 shrink-0 justify-center" aria-hidden="true">
          {folder ? (
            <span
              className={cn(
                "block size-1.5 rotate-[-45deg] border-r border-b border-current transition-transform duration-200",
                node.isOpen && "translate-y-[-1px] rotate-45",
              )}
            />
          ) : null}
        </span>
        <Icon className={cn("size-3.5 shrink-0", selected ? "text-foreground" : "text-muted-foreground/80 group-hover:text-foreground")} />

        {node.isEditing ? (
          <RenameInput node={node} />
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate font-md">{data.name}</span>
            {data.badge ? <span className="bg-primary/10 text-primary shrink-0 rounded-full px-1.5 text-[9px] leading-4">{data.badge}</span> : null}
            <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
              {folder && onCreate ? (
                <RowAction
                  title="New inside"
                  aria-label={`New inside ${data.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    tree.open(node.id);
                    onCreate(node.id);
                  }}
                >
                  <Plus className="size-3.5" />
                </RowAction>
              ) : null}
              {onRename || onDelete ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <RowAction title="More" aria-label={`More actions for ${data.name}`} onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="size-3.5" />
                    </RowAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {onRename ? (
                      <DropdownMenuItem onSelect={() => tree.edit(node.id)}>
                        <Pencil /> Rename
                      </DropdownMenuItem>
                    ) : null}
                    {onDelete ? (
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(node.id)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <AppNavSection title={title} defaultExpanded={defaultExpanded} actions={header} data-slot="app-nav-file-tree" className={className} {...props}>
      {nodes.length === 0 ? (
        <p className="text-muted-foreground/70 px-3 py-1.5 text-xs">{emptyLabel}</p>
      ) : (
        <Tree<AppNavFileNode>
          ref={treeRef}
          data={nodes}
          width="100%"
          height={height}
          rowHeight={ROW_HEIGHT}
          indent={INDENT}
          initialOpenState={initialOpen}
          openByDefault={false}
          disableMultiSelection
          disableDrag={!onMove}
          disableDrop={!onMove}
          disableEdit={!onRename}
          onToggle={handleToggle}
          onRename={({ id, name }) => {
            if (name.trim()) onRename?.(id, name.trim());
          }}
          onMove={({ dragIds, parentId, parentNode, index }) => {
            const siblings = (parentNode ? parentNode.children : treeRef.current?.root.children)?.map((child) => child.id) ?? [];
            onMove?.({ ids: dragIds, parentId, index: adjustMoveIndex({ index, dragIds, siblingIds: siblings }) });
          }}
          className="outline-none"
        >
          {renderNode}
        </Tree>
      )}
    </AppNavSection>
  );
}
