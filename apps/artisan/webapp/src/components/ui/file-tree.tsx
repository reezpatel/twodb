import * as React from "react";
import { ChevronRight, File, FileCode2, Folder, FolderOpen } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface FileTreeItem {
  id: string;
  name: string;
  kind: "file" | "folder";
  depth?: number;
  /** Folders: open by default. */
  expanded?: boolean;
  status?: "added" | "deleted" | "modified";
  /** Optional per-file line counts, shown on the right. */
  additions?: number | null;
  deletions?: number | null;
  title?: string;
}

export interface FileTreeProps extends Omit<React.ComponentProps<"section">, "onSelect" | "title"> {
  items: FileTreeItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  title?: string;
  /** Hide the card chrome + header (for embedding in a panel). */
  bare?: boolean;
  headerExtra?: React.ReactNode;
}

interface TreeNode extends FileTreeItem {
  children: TreeNode[];
  changes: number;
  parentId?: string;
}

const STATUS_COPY = { added: "A", deleted: "D", modified: "M" } as const;
const STATUS_LABEL = { added: "Added", deleted: "Deleted", modified: "Modified" } as const;

function buildTree(items: FileTreeItem[]) {
  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];
  for (const item of items) {
    const depth = item.depth ?? 0;
    stack.length = Math.min(stack.length, depth);
    const parent = stack[depth - 1];
    const node: TreeNode = { ...item, children: [], changes: item.status ? 1 : 0, parentId: parent?.id };
    (parent ? parent.children : roots).push(node);
    stack[depth] = node;
  }
  const count = (n: TreeNode): number => {
    if (n.kind === "folder") n.changes = n.children.reduce((s, c) => s + count(c), 0);
    return n.changes;
  };
  roots.forEach(count);
  return roots;
}

function Counts({ additions, deletions }: { additions?: number | null; deletions?: number | null }) {
  if (!additions && !deletions) return null;
  return (
    <span className="flex shrink-0 gap-1.5 font-mono text-[10px] tabular-nums">
      {additions ? <span className="text-success">+{additions}</span> : null}
      {deletions ? <span className="text-destructive">−{deletions}</span> : null}
    </span>
  );
}

/** Accessible tree (arrow-key nav) with a sliding hover/selection highlight and change badges. */
export function FileTree({ className, items, onSelect, selectedId, title = "Files", bare = false, headerExtra, ...props }: FileTreeProps) {
  const tree = React.useMemo(() => buildTree(items), [items]);
  // ids the user flipped away from their default open state
  const [flipped, setFlipped] = React.useState<Set<string>>(() => new Set());
  const defaults = React.useMemo(() => new Map(items.filter((i) => i.kind === "folder").map((i) => [i.id, !!i.expanded])), [items]);
  const isOpenId = (id: string) => (defaults.get(id) ?? false) !== flipped.has(id);

  const [focusedId, setFocusedId] = React.useState<string | undefined>(selectedId ?? items[0]?.id);
  const refs = React.useRef(new Map<string, HTMLLIElement>());
  const rows = React.useRef(new Map<string, HTMLDivElement>());
  const listRef = React.useRef<HTMLDivElement>(null);
  const indicatorRef = React.useRef<HTMLSpanElement>(null);
  const [hoveredId, setHoveredId] = React.useState<string>();
  const [indicator, setIndicator] = React.useState<{ height: number; top: number }>();
  const totalChanges = tree.reduce((s, n) => s + n.changes, 0);

  const visible: TreeNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      visible.push(n);
      if (n.kind === "folder" && isOpenId(n.id)) walk(n.children);
    }
  };
  walk(tree);

  const indicatorId = hoveredId ?? selectedId;

  const measure = React.useCallback(() => {
    const container = listRef.current;
    const row = indicatorId ? rows.current.get(indicatorId) : undefined;
    if (!container || !row) return setIndicator(undefined);
    setIndicator({ height: row.offsetHeight, top: row.getBoundingClientRect().top - container.getBoundingClientRect().top });
  }, [indicatorId]);

  React.useLayoutEffect(() => {
    measure();
  }, [measure, flipped, items]);

  React.useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container.firstElementChild ?? container);
    return () => observer.disconnect();
  }, [measure]);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => indicatorRef.current?.setAttribute("data-ready", "true"));
    return () => cancelAnimationFrame(frame);
  }, []);

  const setOpen = (id: string, open: boolean) =>
    setFlipped((cur) => {
      const next = new Set(cur);
      const wantFlip = (defaults.get(id) ?? false) !== open;
      if (wantFlip) next.add(id);
      else next.delete(id);
      return next;
    });

  const select = (n: TreeNode) => {
    if (n.kind === "folder") return setOpen(n.id, !isOpenId(n.id));
    onSelect?.(n.id);
  };

  const focus = (id: string | undefined) => {
    if (!id) return;
    setFocusedId(id);
    refs.current.get(id)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, n: TreeNode) => {
    const index = visible.findIndex((v) => v.id === n.id);
    const open = n.kind === "folder" && isOpenId(n.id);
    const keys: Record<string, () => void> = {
      ArrowDown: () => focus(visible[index + 1]?.id),
      ArrowUp: () => focus(visible[index - 1]?.id),
      Home: () => focus(visible[0]?.id),
      End: () => focus(visible[visible.length - 1]?.id),
      ArrowRight: () => (n.kind !== "folder" ? undefined : open ? focus(n.children[0]?.id) : setOpen(n.id, true)),
      ArrowLeft: () => (open ? setOpen(n.id, false) : focus(n.parentId)),
      Enter: () => select(n),
      " ": () => select(n),
    };
    if (!keys[event.key]) return;
    event.preventDefault();
    event.stopPropagation();
    keys[event.key]();
  };

  const renderNodes = (nodes: TreeNode[]): React.ReactNode =>
    nodes.map((n) => {
      const depth = n.depth ?? 0;
      const isFolder = n.kind === "folder";
      const isOpen = isFolder && isOpenId(n.id);
      const isSelected = n.id === selectedId;
      const tabbable = n.id === (visible.some((v) => v.id === focusedId) ? focusedId : visible[0]?.id);
      const Glyph = /\.(tsx?|jsx?|json|css|py|rs|go)$/.test(n.name) ? FileCode2 : File;
      return (
        <li
          key={n.id}
          role="treeitem"
          aria-expanded={isFolder ? isOpen : undefined}
          aria-level={depth + 1}
          aria-selected={isFolder ? undefined : isSelected}
          tabIndex={tabbable ? 0 : -1}
          className="outline-none [&:focus-visible>div]:ring-2 [&:focus-visible>div]:ring-ink/20"
          onBlur={(e) => {
            e.stopPropagation();
            if (!e.currentTarget.closest('[role="tree"]')?.contains(e.relatedTarget)) setHoveredId(undefined);
          }}
          onFocus={(e) => {
            e.stopPropagation();
            setFocusedId(n.id);
            if (e.currentTarget.matches(":focus-visible")) setHoveredId(n.id);
          }}
          onKeyDown={(e) => onKeyDown(e, n)}
          ref={(el) => {
            if (el) refs.current.set(n.id, el);
            else refs.current.delete(n.id);
          }}
        >
          <div
            ref={(el) => {
              if (el) rows.current.set(n.id, el);
              else rows.current.delete(n.id);
            }}
            title={n.title ?? n.name}
            className={cn("relative z-10 flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px] transition-colors hover:text-ink", isSelected && "text-ink")}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            onMouseEnter={() => setHoveredId(n.id)}
            onClick={() => {
              setFocusedId(n.id);
              select(n);
            }}
          >
            {isFolder ? (
              <>
                <ChevronRight aria-hidden="true" className={cn("size-3.5 shrink-0 text-ink-muted transition-transform duration-200", isOpen && "rotate-90")} />
                {isOpen ? <FolderOpen aria-hidden="true" className="size-4 shrink-0 text-ink-muted" /> : <Folder aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />}
              </>
            ) : (
              <>
                <span className="w-3.5 shrink-0" />
                <Glyph aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
              </>
            )}
            <span className={cn("min-w-0 flex-1 truncate", isFolder ? "font-mono text-[12px]" : "font-mono text-[12px]")}>{n.name}</span>
            {!isFolder ? <Counts additions={n.additions} deletions={n.deletions} /> : null}
            {n.status ? (
              <span className={cn("w-3 shrink-0 text-center text-[10px] font-medium", n.status === "added" && "text-success", n.status === "deleted" && "text-destructive", n.status === "modified" && "text-warning")}>
                <span aria-hidden="true">{STATUS_COPY[n.status]}</span>
                <span className="sr-only">{STATUS_LABEL[n.status]}</span>
              </span>
            ) : isFolder && n.changes > 0 && !isOpen ? (
              <span className="text-[10px] font-medium tabular-nums">
                {n.changes}
                <span className="sr-only"> changes</span>
              </span>
            ) : null}
          </div>
          {isFolder && isOpen ? (
            <ul role="group" className="space-y-0.5 pt-0.5">
              {renderNodes(n.children)}
            </ul>
          ) : null}
        </li>
      );
    });

  return (
    <section
      data-slot="file-tree"
      className={cn(bare ? "flex min-h-0 flex-col text-ink-muted" : "rounded-2xl border border-outline bg-surface p-2 text-sm text-ink-muted shadow-sm", className)}
      {...props}
    >
      {bare ? null : (
        <header className="flex items-center gap-2 px-2 py-1.5">
          <h3 className="text-[14px] font-medium text-ink-muted">{title}</h3>
          {headerExtra}
          {totalChanges > 0 ? (
            <span className="ml-auto text-xs tabular-nums">
              {totalChanges} {totalChanges === 1 ? "change" : "changes"}
            </span>
          ) : null}
        </header>
      )}
      <div className="relative" onMouseLeave={() => setHoveredId(undefined)} ref={listRef}>
        <ul aria-label={title} className="space-y-0.5" role="tree">
          {renderNodes(tree)}
        </ul>
        <span
          aria-hidden="true"
          ref={indicatorRef}
          className="pointer-events-none absolute inset-x-0 top-0 z-0 rounded-md bg-surface-muted data-[ready=true]:transition-[top,height,opacity] data-[ready=true]:duration-200 data-[ready=true]:ease-out"
          style={{ height: indicator?.height ?? 0, opacity: indicator ? 1 : 0, top: indicator?.top ?? 0 }}
        />
      </div>
    </section>
  );
}

export default FileTree;
