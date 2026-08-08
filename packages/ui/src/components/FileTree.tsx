import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from "lucide-react";

export interface FileTreeNode {
  id: string;
  label: string;
  children?: FileTreeNode[];
  /** Custom icon; defaults to folder / file by shape. */
  icon?: ReactNode;
  /** Right-aligned tabular count. */
  count?: number;
}

export interface FileTreeProps {
  nodes: FileTreeNode[];
  selected?: string;
  onSelect?: (id: string) => void;
  defaultExpanded?: string[];
  "aria-label"?: string;
}

export function FileTree({
  nodes,
  selected,
  onSelect,
  defaultExpanded = [],
  "aria-label": ariaLabel = "Files",
}: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(defaultExpanded));

  function toggle(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="tw-ftree" role="tree" aria-label={ariaLabel}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          expanded={expanded}
          toggle={toggle}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: FileTreeNode;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selected?: string;
  onSelect?: (id: string) => void;
}

function TreeNode({ node, expanded, toggle, selected, onSelect }: TreeNodeProps) {
  const kids = node.children ?? [];
  const isOpen = expanded.has(node.id);
  const isSelected = selected === node.id;

  return (
    <div className="tw-ftree__node">
      <button
        type="button"
        role="treeitem"
        aria-expanded={kids.length ? isOpen : undefined}
        aria-selected={isSelected}
        className={isSelected ? "tw-ftree__row tw-ftree__row--selected" : "tw-ftree__row"}
        onClick={() => {
          onSelect?.(node.id);
          if (kids.length) toggle(node.id);
        }}
      >
        <span className="tw-ftree__icon">
          {node.icon ?? (kids.length ? (isOpen ? <FolderOpen /> : <Folder />) : <File />)}
        </span>
        <span className="tw-ftree__label">{node.label}</span>
        {node.count != null ? <b className="tw-ftree__count tw-tnum">{node.count}</b> : null}
        {kids.length ? (
          <span className={isOpen ? "tw-ftree__chev tw-ftree__chev--open" : "tw-ftree__chev"}>
            {isOpen ? <ChevronDown /> : <ChevronRight />}
          </span>
        ) : null}
      </button>
      {kids.length && isOpen ? (
        <div className="tw-ftree__children" role="group">
          {kids.map((kid) => (
            <TreeNode
              key={kid.id}
              node={kid}
              expanded={expanded}
              toggle={toggle}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
