import * as React from "react";
import { ChevronRight, File, FileCode2, FileText, Folder } from "lucide-react";
import { cn } from "../../lib/utils";

export type FolderNode = {
  name: string;
  type: "file" | "folder";
  children?: FolderNode[];
};

function iconFor(node: FolderNode): React.ElementType {
  if (node.type === "folder") return Folder;
  if (node.name.endsWith(".ts") || node.name.endsWith(".tsx") || node.name.endsWith(".js")) return FileCode2;
  if (node.name.endsWith(".md")) return FileText;
  return File;
}

export interface FolderTreeProps extends Omit<React.ComponentProps<"div">, "onSelect"> {
  nodes: FolderNode[];
  /** Currently selected file path (joined with "/"). */
  selected?: string;
  onSelect?: (path: string) => void;
  /** Start with all folders expanded. */
  defaultOpen?: boolean;
}

/** A recursive file/folder tree. Folders are collapsible. */
function FolderTree({ nodes, selected, onSelect, defaultOpen = true, className, ...props }: FolderTreeProps) {
  return (
    <div data-slot="folder-tree" className={cn("flex flex-col gap-0.5 font-mono text-[12px]", className)} {...props}>
      {nodes.map((node) => (
        <FolderTreeNode key={node.name} node={node} path={node.name} selected={selected} onSelect={onSelect} defaultOpen={defaultOpen} depth={0} />
      ))}
    </div>
  );
}

function FolderTreeNode({
  node,
  path,
  selected,
  onSelect,
  defaultOpen,
  depth,
}: {
  node: FolderNode;
  path: string;
  selected?: string;
  onSelect?: (path: string) => void;
  defaultOpen: boolean;
  depth: number;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isSelected = selected === path;
  const Icon = iconFor(node);
  const isFolder = node.type === "folder";

  return (
    <div>
      <button
        type="button"
        onClick={() => (isFolder ? setOpen((o) => !o) : onSelect?.(path))}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-[6px] px-2 py-1 text-left outline-none transition-colors",
          isSelected ? "bg-stone text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-ion-deep focus-visible:-outline-offset-2",
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {isFolder ? <ChevronRight className={cn("size-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} strokeWidth={2} /> : <span className="size-3 shrink-0" />}
        <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <span className="truncate">{node.name}</span>
      </button>
      {isFolder && open && node.children ? (
        <div>
          {node.children.map((child) => (
            <FolderTreeNode key={child.name} node={child} path={`${path}/${child.name}`} selected={selected} onSelect={onSelect} defaultOpen={defaultOpen} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { FolderTree };
