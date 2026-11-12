import { useState } from "react";
import { ChevronRight, Copy, Database, FilePlus, MoreHorizontal, Plus, Star, StarOff, Trash2 } from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import type { TreeNode } from "@shared/model";
import { cn } from "@twodb/blocks";
import { useChildren, type Garden } from "../../lib/queries";
import { Popover } from "../../ui/Popover";
import { MenuButton, MenuSeparator } from "../../ui/MenuButton";
import { RecordIcon } from "../../ui/RecordIcon";
import type { DropZone } from "../hooks/useTreeDnd";

export interface TreeCtx {
  childrenOf: (id: string) => TreeNode[];
  garden: Garden;
  dnd: { target: { id: string; zone: DropZone } | null; bind: (n: TreeNode) => Record<string, unknown> };
  expanded: Set<string>;
  toggle: (id: string, open?: boolean) => void;
}

/** One sidebar row (page or database) + its children; database rows load lazily. */
export function TreeItem({ node, depth, ctx, showChildren = true }: { node: TreeNode; depth: number; ctx: TreeCtx; showChildren?: boolean }) {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const open = ctx.expanded.has(node.id);
  const isDb = node.kind === "database";
  const rows = useChildren(node.id, open && isDb && showChildren);
  const kids = isDb ? (rows.data?.nodes ?? []) : ctx.childrenOf(node.id);
  const hasKids = node.childCount > 0 || kids.length > 0;
  const drop = ctx.dnd.target?.id === node.id ? ctx.dnd.target.zone : null;

  const addChild = async () => {
    const p = await ctx.garden.createPage({ parentId: node.id });
    ctx.toggle(node.id, true);
    navigate(`/${p.id}`);
  };

  return (
    <div>
      <div
        {...(ctx.dnd.bind(node) as object)}
        className={cn(
          "group/ti relative flex h-[30px] items-center rounded-md pr-1 text-[13.5px]",
          drop === "inside" && "bg-ion/30",
          drop === "before" && "before:absolute before:inset-x-1 before:top-0 before:h-[2px] before:rounded before:bg-ion-deep",
          drop === "after" && "after:absolute after:inset-x-1 after:bottom-0 after:h-[2px] after:rounded after:bg-ion-deep",
        )}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        <button
          type="button"
          onClick={() => ctx.toggle(node.id)}
          className={cn("flex size-5 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-ink/[0.08]", !hasKids && showChildren && "opacity-0 group-hover/ti:opacity-60")}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {showChildren ? <ChevronRight size={13} className={cn("transition-transform", open && "rotate-90")} /> : null}
        </button>
        <NavLink
          to={`/${node.id}`}
          className={({ isActive }) =>
            cn("flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 hover:bg-ink/[0.05]", isActive ? "bg-ink/[0.07] font-medium text-ink" : "text-ink/85")
          }
        >
          <RecordIcon icon={node.icon} kind={node.kind} size={15} />
          <span className="truncate">{node.title || (isDb ? "Untitled database" : "Untitled")}</span>
        </NavLink>
        <div className={cn("absolute right-1 flex items-center gap-px rounded-md bg-stone opacity-0 group-hover/ti:opacity-100", menu && "opacity-100")}>
          <Popover
            open={menu}
            onOpenChange={setMenu}
            trigger={
              <button type="button" className="flex size-6 items-center justify-center rounded text-ink-muted hover:bg-ink/[0.08] hover:text-ink" aria-label="More">
                <MoreHorizontal size={14} />
              </button>
            }
          >
            <div className="w-[220px] p-1" onClick={() => setMenu(false)}>
              <MenuButton icon={node.isFavorite ? <StarOff size={14} /> : <Star size={14} />} onClick={() => void ctx.garden.patchRecord(node.id, { isFavorite: !node.isFavorite })}>
                {node.isFavorite ? "Remove from favorites" : "Add to favorites"}
              </MenuButton>
              {!isDb ? (
                <>
                  <MenuButton icon={<FilePlus size={14} />} onClick={() => void addChild()}>
                    Add sub-page
                  </MenuButton>
                  <MenuButton
                    icon={<Database size={14} />}
                    onClick={() => void ctx.garden.createDatabase({ parentId: node.id }).then((d) => (ctx.toggle(node.id, true), navigate(`/${d.database.id}`)))}
                  >
                    Add database
                  </MenuButton>
                </>
              ) : null}
              <MenuButton icon={<Copy size={14} />} onClick={() => void navigator.clipboard.writeText(`${location.origin}/${node.id}`)}>
                Copy link
              </MenuButton>
              <MenuSeparator />
              <MenuButton danger icon={<Trash2 size={14} />} onClick={() => void ctx.garden.trash(node.id)}>
                Move to trash
              </MenuButton>
            </div>
          </Popover>
          <button type="button" onClick={() => void addChild()} className="flex size-6 items-center justify-center rounded text-ink-muted hover:bg-ink/[0.08] hover:text-ink" aria-label="Add page inside">
            <Plus size={14} />
          </button>
        </div>
      </div>
      {open && showChildren ? (
        <div>
          {kids.map((k) => (
            <TreeItem key={k.id} node={k} depth={depth + 1} ctx={ctx} />
          ))}
          {!kids.length && !(isDb && rows.isLoading) ? (
            <div className="h-[26px] text-[12.5px] leading-[26px] text-ink-muted/70" style={{ paddingLeft: 30 + (depth + 1) * 14 }}>
              {isDb ? "No pages" : "No pages inside"}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
